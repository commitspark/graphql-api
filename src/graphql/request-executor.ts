import {
  DocumentNode,
  execute,
  ExecutionResult,
  getOperationAST,
  GraphQLError,
  GraphQLFormattedError,
  GraphQLSchema,
  parse,
  validate,
} from 'graphql'
import { ErrorCode } from './errors.ts'

interface ExecutedRequest<TData> {
  data?: TData | null
  errors?: ReadonlyArray<GraphQLFormattedError>
}

/**
 * Executes a GraphQL request against the schema. Errors are returned in the response instead of being thrown, as
 * usual in GraphQL:
 * - request errors, i.e. errors that prevent execution such as syntax errors, validation errors, an operation that
 *   cannot be determined or invalid variable values, are returned with code `BAD_GRAPHQL_REQUEST` and without data
 * - errors during execution keep their code; errors without a code are returned with code `INTERNAL_ERROR`
 */
export async function executeRequest<TData>(
  schema: GraphQLSchema,
  query: string | DocumentNode | null | undefined,
  variableValues: Record<string, unknown> | null | undefined,
  operationName: string | null | undefined,
  contextValue: unknown,
): Promise<ExecutedRequest<TData>> {
  // GraphQL reports an empty query as syntax error, but fails on a missing query with an exception
  if (query === undefined || query === null) {
    return requestErrors([
      new GraphQLError('GraphQL request must contain a query.'),
    ])
  }

  let document: DocumentNode
  if (typeof query === 'string') {
    try {
      document = parse(query)
    } catch (error) {
      if (error instanceof GraphQLError) {
        return requestErrors([error])
      }
      throw error
    }
  } else {
    document = query
  }

  const validationErrors = validate(schema, document)
  if (validationErrors.length > 0) {
    return requestErrors(validationErrors)
  }

  // GraphQL reports a subscription only when executing it, as an execution error, although it is a request that
  // cannot be executed at all
  if (getOperationAST(document, operationName)?.operation === 'subscription') {
    return requestErrors([new GraphQLError('Subscriptions are not supported.')])
  }

  const result: ExecutionResult = await execute({
    schema,
    document,
    variableValues,
    operationName,
    contextValue,
  })

  // results without data are results of request errors, e.g. invalid variable values or an operation that cannot be
  // determined, as execution itself always produces data
  if (!('data' in result)) {
    return requestErrors(result.errors ?? [])
  }

  const executedRequest: ExecutedRequest<TData> = {
    data: result.data as TData | null,
  }
  if (result.errors !== undefined) {
    executedRequest.errors = result.errors.map((error) =>
      formatError(error, ErrorCode.INTERNAL_ERROR),
    )
  }
  return executedRequest
}

function requestErrors<TData>(
  errors: ReadonlyArray<GraphQLError>,
): ExecutedRequest<TData> {
  return {
    errors: errors.map((error) =>
      formatError(error, ErrorCode.BAD_GRAPHQL_REQUEST),
    ),
  }
}

/**
 * Formats an error for the response, setting `defaultCode` if the error has no code.
 */
export function formatError(
  error: GraphQLError,
  defaultCode: ErrorCode,
): GraphQLFormattedError {
  const formatted = error.toJSON()
  if (formatted.extensions?.code !== undefined) {
    return formatted
  }
  return {
    ...formatted,
    extensions: { ...formatted.extensions, code: defaultCode },
  }
}
