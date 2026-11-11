import { GraphQLSchema } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { Entry } from '@commitspark/git-adapter'
import { ApolloContext } from '../client.ts'
import { generateSchema } from '../graphql/schema-generator.ts'
import { getValidationResult } from '../graphql/schema-validator.ts'
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
  let originalSchema: GraphQLSchema
  try {
    originalSchema = makeExecutableSchema({ typeDefs: schemaString })
  } catch (error) {
    return [
      createViolation(
        ViolationCode.INVALID_SCHEMA,
        error instanceof Error ? error.message : String(error),
        [],
      ),
    ]
  }
  const schemaViolations = getValidationResult(originalSchema).map((message) =>
    createViolation(ViolationCode.INVALID_SCHEMA, message, []),
  )
  if (schemaViolations.length > 0) {
    return schemaViolations
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
    `Entry "${entry.id}" does not match the schema: ` +
      errors
        .map((violation) =>
          violation.path.length > 0
            ? `${violation.path.join('.')}: ${violation.message}`
            : violation.message,
        )
        .join(' '),
    ErrorCode.BAD_REPOSITORY_DATA,
    {
      typeName: entry.metadata.type,
      fieldValue: entry.id,
      violations: errors,
    },
  )
}
