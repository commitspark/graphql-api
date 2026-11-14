import { CommitDraft, Entry, EntryDraft } from '@commitspark/git-adapter'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { GraphQLSchema } from 'graphql'
import { RequestContext } from '../client.ts'
import { createError, ErrorCode } from '../graphql/errors.ts'
import { getCommitMessageOrDefault } from '../graphql/resolvers/commit-message.ts'
import { assertValidNewEntryId } from '../graphql/resolvers/new-entry-id.ts'
import { CommitInput } from '../graphql/resolvers/types.ts'
import {
  generateSchema,
  generateSchemaFromString,
} from '../graphql/schema-generator.ts'
import { validateSchemaDefinition } from '../graphql/schema-validator.ts'
import { commitWithRetry } from '../persistence/commit-with-retry.ts'
import { validateEntry } from '../validation/entry-validator.ts'
import { assertNoErrors } from '../validation/repository-validator.ts'
import {
  createViolation,
  Violation,
  ViolationCode,
} from '../validation/violation.ts'

export interface MigrationSnapshot {
  /**
   * Commit hash of the snapshot.
   */
  ref: string
  /**
   * Content of the schema file.
   */
  schema: string
  /**
   * All entries as stored in the repository, keyed by ID, including entries of types that are not in the schema.
   * Changes to these objects have no effect.
   */
  entries: ReadonlyMap<string, Entry>
}

export interface MigrationResult {
  /**
   * New content of the schema file; the schema is left unchanged if not set.
   */
  schema?: string
  /**
   * Entries to write or delete, each with its complete content as it is to be stored.
   */
  entries: EntryDraft[]
  commit?: CommitInput
}

export type MigrationFn = (
  snapshot: MigrationSnapshot,
) => MigrationResult | Promise<MigrationResult>

export interface MigrationResponse {
  /**
   * Hash of the new commit, or of the commit the migration was based on if the migration changed nothing.
   */
  ref: string
}

/**
 * Runs `migration` on a snapshot of the branch head and commits its result as a single commit. The result is validated
 * as a whole before committing, so that entries can reference each other, and the schema can be changed together with
 * the entries. If the branch moves before committing, `migration` is run again on the new branch head.
 */
export async function migrate(
  context: RequestContext,
  migration: MigrationFn,
  defaultCommitMessage = 'Migrate entries',
): Promise<MigrationResponse> {
  await commitWithRetry(context, async () => {
    const parentSha = context.getCurrentHash()
    const schema = await context.repositoryCache.getSchema(context, parentSha)
    const entriesRecord = await context.repositoryCache.getEntriesRecord(
      context,
      parentSha,
    )
    // entries are cloned, as the cached objects are shared with other requests
    const entries = new Map(
      [...entriesRecord.byId].map(([id, entry]) => [
        id,
        structuredClone(entry),
      ]),
    )

    const result = await migration({ ref: parentSha, schema, entries })

    const commitMessage = getCommitMessageOrDefault(
      result.commit,
      defaultCommitMessage,
    )
    const existingEntries = entriesRecord.byId
    const changedEntries = getChangedEntries(result.entries, existingEntries)
    const newSchema =
      result.schema !== undefined && result.schema !== schema
        ? result.schema
        : undefined
    if (changedEntries.length === 0 && newSchema === undefined) {
      return undefined
    }

    const finalEntries = new Map<string, Entry>(existingEntries)
    for (const draft of changedEntries) {
      if (draft.deletion) {
        finalEntries.delete(draft.id)
      } else {
        finalEntries.set(draft.id, draft)
      }
    }

    if (newSchema !== undefined) {
      const { problems } = validateSchemaDefinition(newSchema)
      assertNoErrors(
        problems.map((message) =>
          createViolation(ViolationCode.INVALID_SCHEMA, message, []),
        ),
      )
      // a new schema can affect any entry, so all entries must be valid
      assertNoErrors(
        validateEntries(
          makeExecutableSchema(generateSchemaFromString(context, newSchema)),
          finalEntries,
        ),
      )
    } else {
      // only errors caused by the migration block the commit, so that existing problems, e.g. of other entries, do
      // not prevent migrating
      const generatedSchema = makeExecutableSchema(
        await generateSchema(context),
      )
      const existingErrorKeys = new Set(
        validateEntries(generatedSchema, existingEntries).map(getViolationKey),
      )
      assertNoErrors(
        validateEntries(generatedSchema, finalEntries).filter(
          (violation) => !existingErrorKeys.has(getViolationKey(violation)),
        ),
      )
    }

    const commitDraft: CommitDraft = {
      ref: context.branch,
      parentSha,
      entries: changedEntries,
      ...commitMessage,
    }
    if (newSchema !== undefined) {
      commitDraft.schema = newSchema
    }
    return commitDraft
  })

  return { ref: context.getCurrentHash() }
}

/**
 * Checks the entry drafts of a migration result and returns those that change the repository.
 */
function getChangedEntries(
  drafts: EntryDraft[],
  existingEntries: Map<string, Entry>,
): EntryDraft[] {
  const seenIds = new Set<string>()
  const changedEntries: EntryDraft[] = []
  for (const draft of drafts) {
    const details = { fieldName: 'id', fieldValue: draft.id }
    if (seenIds.has(draft.id)) {
      throw createError(
        `Entry "${draft.id}" is contained more than once in the migration result.`,
        ErrorCode.BAD_USER_INPUT,
        details,
      )
    }
    seenIds.add(draft.id)

    const existingEntry = existingEntries.get(draft.id)
    if (draft.deletion) {
      if (existingEntry === undefined) {
        throw createError(
          `Entry "${draft.id}" cannot be deleted, as it does not exist.`,
          ErrorCode.BAD_USER_INPUT,
          details,
        )
      }
      changedEntries.push(draft)
      continue
    }

    if (existingEntry === undefined) {
      assertValidNewEntryId(draft.id, details)
      changedEntries.push(draft)
      continue
    }
    // compared in serialized form, as the stored file also changes if only the order of keys changes
    if (serializeContent(draft) !== serializeContent(existingEntry)) {
      changedEntries.push(draft)
    }
  }
  return changedEntries
}

function serializeContent(entry: Entry): string {
  return JSON.stringify([entry.metadata, entry.data])
}

/**
 * Validates all entries of a repository state, ordered by ID.
 */
function validateEntries(
  generatedSchema: GraphQLSchema,
  entries: Map<string, Entry>,
): Violation[] {
  const getEntryType = (id: string) => entries.get(id)?.metadata.type
  return [...entries.values()]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .flatMap((entry) => validateEntry(generatedSchema, entry, getEntryType))
}

/**
 * Identifies a violation independent of the repository state it was found in, e.g. to find violations that already
 * existed before a change.
 */
function getViolationKey(violation: Violation): string {
  return JSON.stringify([
    violation.entryId,
    violation.code,
    violation.path,
    violation.message,
  ])
}
