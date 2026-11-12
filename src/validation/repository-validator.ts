import { GraphQLSchema } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { Entry, EntryDraft } from '@commitspark/git-adapter'
import { ApolloContext } from '../client.ts'
import { generateSchema } from '../graphql/schema-generator.ts'
import { validateSchemaDefinition } from '../graphql/schema-validator.ts'
import { createError, ErrorCode } from '../graphql/errors.ts'
import { validateEntry } from './entry-validator.ts'
import {
  createViolation,
  Violation,
  ViolationCode,
  ViolationSeverity,
} from './violation.ts'

/**
 * Validates the schema and all entries at the current commit of the context. Entries are only validated if the
 * schema is valid.
 */
export async function validateRepository(
  context: ApolloContext,
): Promise<Violation[]> {
  const schemaString = await context.repositoryCache.getSchema(
    context,
    context.getCurrentHash(),
  )
  const { problems } = validateSchemaDefinition(schemaString)
  if (problems.length > 0) {
    return problems.map((message) =>
      createViolation(ViolationCode.INVALID_SCHEMA, message, []),
    )
  }

  const generatedSchema = makeExecutableSchema(await generateSchema(context))
  const entriesRecord = await context.repositoryCache.getEntriesRecord(
    context,
    context.getCurrentHash(),
  )
  const getEntryType = (id: string) => entriesRecord.byId.get(id)?.metadata.type
  return [...entriesRecord.byId.values()]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .flatMap((entry) => validateEntry(generatedSchema, entry, getEntryType))
}

/**
 * Throws `BAD_USER_INPUT` if any entry written by a commit draft would have violations of severity error, so that
 * commits never create entries that cannot be read. Entries are validated against the current commit of the context
 * with the draft applied, e.g. so that a new entry can reference itself. Unknown keys are retained and only reported
 * as warnings, so they do not prevent the commit.
 */
export async function assertValidEntryDrafts(
  context: ApolloContext,
  generatedSchema: GraphQLSchema,
  entryDrafts: EntryDraft[],
): Promise<void> {
  const entriesRecord = await context.repositoryCache.getEntriesRecord(
    context,
    context.getCurrentHash(),
  )
  const draftsById = new Map(entryDrafts.map((draft) => [draft.id, draft]))
  const getEntryType = (id: string) => {
    const draft = draftsById.get(id)
    if (draft !== undefined) {
      return draft.deletion ? undefined : draft.metadata.type
    }
    return entriesRecord.byId.get(id)?.metadata.type
  }

  const errors = entryDrafts
    .filter((draft) => !draft.deletion)
    .flatMap((draft) => validateEntry(generatedSchema, draft, getEntryType))
    .filter((violation) => violation.severity === ViolationSeverity.ERROR)
  if (errors.length === 0) {
    return
  }
  const affectedEntryIds = [
    ...new Set(errors.map((violation) => violation.entryId)),
  ].sort()
  const message =
    affectedEntryIds.length === 1
      ? `Entry "${affectedEntryIds[0]}" would not match the schema: ${formatViolations(errors, false)}`
      : `Entries would not match the schema: ${formatViolations(errors, true)}`
  throw createError(message, ErrorCode.BAD_USER_INPUT, {
    fieldValue: affectedEntryIds.join(', '),
    violations: errors,
  })
}

/**
 * Throws `BAD_REPOSITORY_DATA` if an entry has violations of severity error at the current commit of the context.
 * Called for every entry before its data is returned, so that resolvers only process data that matches the schema.
 */
export async function assertValidEntry(
  context: ApolloContext,
  generatedSchema: GraphQLSchema,
  entry: Entry,
): Promise<void> {
  const entriesRecord = await context.repositoryCache.getEntriesRecord(
    context,
    context.getCurrentHash(),
  )
  const errors = validateEntry(
    generatedSchema,
    entry,
    (id) => entriesRecord.byId.get(id)?.metadata.type,
  ).filter((violation) => violation.severity === ViolationSeverity.ERROR)
  if (errors.length === 0) {
    return
  }
  throw createError(
    `Entry "${entry.id}" does not match the schema: ${formatViolations(errors, false)}`,
    ErrorCode.BAD_REPOSITORY_DATA,
    {
      typeName: entry.metadata.type,
      fieldValue: entry.id,
      violations: errors,
    },
  )
}

/**
 * Formats violations for an error message. Entry IDs are only included if requested, so that messages that already
 * name the single affected entry do not repeat its ID for every violation.
 */
function formatViolations(
  violations: Violation[],
  includeEntryId: boolean,
): string {
  return violations
    .map((violation) => {
      const location = [
        ...(includeEntryId && violation.entryId !== undefined
          ? [violation.entryId]
          : []),
        ...(violation.path.length > 0 ? [violation.path.join('.')] : []),
      ].join(' ')
      return location.length > 0
        ? `${location}: ${violation.message}`
        : violation.message
    })
    .join(' ')
}
