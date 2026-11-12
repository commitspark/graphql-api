import * as graphql from 'graphql'
import { GraphQLError, GraphQLInputType } from 'graphql'

type OnError = (error: GraphQLError) => void

// graphql 16 reports errors of input coercion through a callback of `coerceInputValue`; graphql 17 removed this
// callback in favor of `validateInputValue`, which takes a callback with a different signature. The functions are
// accessed untyped, as only the types of one graphql version are available at compile time.
const graphqlFunctions = graphql as unknown as {
  validateInputValue?: (
    value: unknown,
    type: GraphQLInputType,
    onError: (
      error: GraphQLError,
      path: ReadonlyArray<string | number>,
    ) => void,
  ) => void
  coerceInputValue: (
    value: unknown,
    type: GraphQLInputType,
    onError: (
      path: ReadonlyArray<string | number>,
      invalidValue: unknown,
      error: GraphQLError,
    ) => void,
  ) => unknown
}

/**
 * Validates a value as GraphQL input value of the given type and reports every error found, with the same messages in
 * graphql 16 and 17.
 */
export function validateInputValue(
  value: unknown,
  type: GraphQLInputType,
  onError: OnError,
): void {
  if (graphqlFunctions.validateInputValue !== undefined) {
    graphqlFunctions.validateInputValue(value, type, (error) => onError(error))
    return
  }
  graphqlFunctions.coerceInputValue(
    value,
    type,
    (_path, _invalidValue, error) => onError(error),
  )
}
