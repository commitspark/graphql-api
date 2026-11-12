import { Entry, EntryData } from '@commitspark/git-adapter'
import { GraphQLSchema } from 'graphql'
import { ApolloContext } from '../../client.ts'
import { createError, ErrorCode } from '../errors.ts'
import { validateEntry } from '../../validation/entry-validator.ts'
import {
  formatViolations,
  Violation,
  ViolationSeverity,
} from '../../validation/violation.ts'

type Path = (string | number)[]

/**
 * Information about an object returned to GraphQL for (a part of) an entry: the entry it belongs to, its path within
 * the data of the entry, and the violations of severity error found in the entry.
 */
export interface DataSourceContext {
  entryId: string
  entryType: string
  path: Path
  errors: Violation[]
}

// keyed by the objects returned to GraphQL, which are created for this purpose, so that cached entry data is never
// modified and the information is released together with the objects
const dataSourceContexts = new WeakMap<object, DataSourceContext>()

/**
 * Validates an entry and returns the object that GraphQL resolves the fields of the entry from. Violations are not
 * reported here but by the resolvers of the affected fields, so that GraphQL reports every violation at its position
 * in the response and applies the nullability of the schema. Only violations of the entry data as a whole, e.g. data
 * that is not an object, are reported here, i.e. at the position of the entry.
 */
export async function createEntrySource(
  context: ApolloContext,
  schema: GraphQLSchema,
  entry: Entry,
): Promise<EntryData & { id: string }> {
  const entriesRecord = await context.repositoryCache.getEntriesRecord(
    context,
    context.getCurrentHash(),
  )
  const errors = validateEntry(
    schema,
    entry,
    (id) => entriesRecord.byId.get(id)?.metadata.type,
  ).filter((violation) => violation.severity === ViolationSeverity.ERROR)
  const sourceContext: DataSourceContext = {
    entryId: entry.id,
    entryType: entry.metadata.type,
    path: [],
    errors,
  }
  throwViolationsAt(sourceContext, [])

  const source = { ...(entry.data ?? {}), id: entry.id }
  dataSourceContexts.set(source, sourceContext)
  return source
}

/**
 * Returns the object that GraphQL resolves the fields of an embedded object from, e.g. the value of an object or union
 * field at `path` within the entry.
 */
export function createEmbeddedSource(
  parent: DataSourceContext,
  data: EntryData,
  path: Path,
  additionalFields: EntryData = {},
): EntryData {
  const source = { ...data, ...additionalFields }
  dataSourceContexts.set(source, { ...parent, path })
  return source
}

export function getDataSourceContext(source: object): DataSourceContext {
  const sourceContext = dataSourceContexts.get(source)
  if (sourceContext === undefined) {
    throw createError(
      'Missing information about the entry of resolved data.',
      ErrorCode.INTERNAL_ERROR,
      {},
    )
  }
  return sourceContext
}

/**
 * Throws `BAD_REPOSITORY_DATA` listing the violations at exactly the given path within the entry, if any.
 */
export function throwViolationsAt(
  sourceContext: DataSourceContext,
  path: Path,
): void {
  const violations = sourceContext.errors.filter(
    (violation) =>
      violation.path.length === path.length &&
      violation.path.every((segment, index) => segment === path[index]),
  )
  if (violations.length === 0) {
    return
  }
  throw createError(
    `Entry "${sourceContext.entryId}" does not match the schema: ${formatViolations(violations, false)}`,
    ErrorCode.BAD_REPOSITORY_DATA,
    {
      typeName: sourceContext.entryType,
      fieldValue: sourceContext.entryId,
      violations,
    },
  )
}
