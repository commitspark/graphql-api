import { GitAdapterError } from '@commitspark/git-adapter'
import { GraphQLError } from 'graphql'
import { createError, ErrorCode } from '../graphql/errors.ts'

/**
 * Converts an error thrown by a Git adapter to a GraphQL error, keeping the error code of a `GitAdapterError`.
 */
export const toGraphQLError = (err: unknown): GraphQLError => {
  if (err instanceof GitAdapterError) {
    return createError(err.message, err.code, {})
  }
  const message = err instanceof Error ? err.message : String(err)
  return createError(message, ErrorCode.INTERNAL_ERROR, {})
}

/**
 * Runs a Git adapter operation and converts thrown errors to GraphQL errors.
 */
export const callGitAdapter = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  try {
    return await operation()
  } catch (err) {
    throw toGraphQLError(err)
  }
}
