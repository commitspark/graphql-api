import { GraphQLSchema } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { EntryDraft } from '@commitspark/git-adapter'
import { RequestContext } from '../client.ts'
import { generateSchema } from '../graphql/schema-generator.ts'
import { validateSchemaDefinition } from '../graphql/schema-validator.ts'
import { createError, ErrorCode } from '../graphql/errors.ts'
import { validateEntry } from './entry-validator.ts'
import {
  createViolation,
  formatViolations,
  Violation,
  ViolationCode,
  ViolationSeverity,
} from './violation.ts'

/**
 * Validates the schema and all entries at the current commit of the context. Entries are only validated if the
 * schema is valid.
 */
export async function validateRepository(
  context: RequestContext,
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
  context: RequestContext,
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

  assertNoErrors(
    entryDrafts
      .filter((draft) => !draft.deletion)
      .flatMap((draft) => validateEntry(generatedSchema, draft, getEntryType)),
  )
}

/**
 * Throws `BAD_USER_INPUT` with all violations of severity error, if there are any.
 */
export function assertNoErrors(violations: Violation[]): void {
  const errors = violations.filter(
    (violation) => violation.severity === ViolationSeverity.ERROR,
  )
  if (errors.length === 0) {
    return
  }
  const schemaErrors = errors.filter(
    (violation) => violation.entryId === undefined,
  )
  if (schemaErrors.length > 0) {
    throw createError(
      `Schema would not be valid: ${formatViolations(schemaErrors, false)}`,
      ErrorCode.BAD_USER_INPUT,
      { violations: errors },
    )
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
