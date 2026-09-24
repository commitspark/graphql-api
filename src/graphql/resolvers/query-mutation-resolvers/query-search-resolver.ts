import { GraphQLError, GraphQLSchema, isObjectType } from 'graphql'
import { SearchAdapterError, SearchHit } from '@commitspark/search-adapter'
import { createError, ErrorCode } from '../../errors.ts'
import { hasEntryDirective } from '../../schema-utils/entry-type-util.ts'
import { extractSearchableFieldValues } from '../../schema-utils/searchable-field-util.ts'
import { SearchQueryResolver } from '../types.ts'

const SEARCH_DEFAULT_LIMIT = 10
const SEARCH_MAX_LIMIT = 100

export const querySearchResolver: SearchQueryResolver = async (
  _source,
  args,
  context,
  info,
) => {
  const searchAdapter = context.searchAdapter
  if (searchAdapter === undefined) {
    throw createError(
      'No search adapter configured.',
      ErrorCode.INTERNAL_ERROR,
      {},
    )
  }

  if (args.query.trim() === '') {
    throw createError(
      'Search query must not be empty.',
      ErrorCode.BAD_USER_INPUT,
      {
        argumentName: 'query',
        argumentValue: args.query,
      },
    )
  }

  const limit = args.first ?? SEARCH_DEFAULT_LIMIT
  if (limit < 1 || limit > SEARCH_MAX_LIMIT) {
    throw createError(
      `Argument "first" must be between 1 and ${SEARCH_MAX_LIMIT}.`,
      ErrorCode.BAD_USER_INPUT,
      {
        argumentName: 'first',
        argumentValue: limit,
      },
    )
  }

  const entryTypes = args.types ?? undefined
  if (entryTypes !== undefined) {
    validateEntryTypeNames(info.schema, entryTypes)
    if (entryTypes.length === 0) {
      return []
    }
  }

  const commitHash = context.getCurrentHash()
  let hits: SearchHit[]
  try {
    hits = await searchAdapter.search({
      commitHash: commitHash,
      query: args.query,
      entryTypes: entryTypes,
      limit: limit,
      getSearchableFieldValues: async () => {
        const entriesRecord = await context.repositoryCache.getEntriesRecord(
          context,
          commitHash,
        )
        return extractSearchableFieldValues(
          info.schema,
          entriesRecord.byId.values(),
        )
      },
    })
  } catch (err) {
    if (err instanceof GraphQLError) {
      throw err
    }
    if (err instanceof SearchAdapterError) {
      throw createError(err.message, err.code, {})
    }
    const message = err instanceof Error ? err.message : String(err)
    throw createError(message, ErrorCode.INTERNAL_ERROR, {})
  }

  return hits.slice(0, limit)
}

function validateEntryTypeNames(
  schema: GraphQLSchema,
  typeNames: string[],
): void {
  for (const typeName of typeNames) {
    const type = schema.getType(typeName)
    if (!isObjectType(type) || !hasEntryDirective(type)) {
      throw createError(
        `Type "${typeName}" is not an entry type.`,
        ErrorCode.BAD_USER_INPUT,
        {
          argumentName: 'types',
          argumentValue: typeName,
        },
      )
    }
  }
}
