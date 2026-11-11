import {
  ApolloExecuteOperationRequest,
  getSchema,
  GraphQLResponse,
  postGraphQL,
  SchemaResponse,
  validate,
  VariableValues,
} from './client.ts'
import { GitAdapter } from '@commitspark/git-adapter'
import { SearchAdapter } from '@commitspark/search-adapter'
import { ErrorCode, ErrorMetadata } from './graphql/errors.ts'
import { createCacheHandler } from './persistence/cache.ts'
import {
  ValidationResult,
  Violation,
  ViolationCode,
  ViolationSeverity,
} from './validation/violation.ts'

interface Client {
  postGraphQL<
    TData = Record<string, unknown>,
    TVariables extends VariableValues = VariableValues,
  >(
    ref: string,
    request: ApolloExecuteOperationRequest<TData, TVariables>,
  ): Promise<GraphQLResponse<TData | null>>
  getSchema(ref: string): Promise<SchemaResponse>
  /**
   * Validates the schema and all entries at the given ref against the schema. Returns all violations found instead
   * of failing on the first one, e.g. to check a repository in CI after changing the schema.
   */
  validate(ref: string): Promise<ValidationResult>
}

interface ClientOptions {
  /**
   * Enables query `_search` when set.
   */
  searchAdapter?: SearchAdapter
}

export {
  Client,
  ClientOptions,
  GraphQLResponse,
  SchemaResponse,
  ErrorCode,
  ErrorMetadata,
  ValidationResult,
  Violation,
  ViolationCode,
  ViolationSeverity,
}

export async function createClient(
  gitAdapter: GitAdapter,
  options: ClientOptions = {},
): Promise<Client> {
  const repositoryCache = createCacheHandler()
  const searchAdapter = options.searchAdapter
  return {
    postGraphQL: (...args) =>
      postGraphQL(gitAdapter, searchAdapter, repositoryCache, ...args),
    getSchema: (...args) =>
      getSchema(gitAdapter, searchAdapter, repositoryCache, ...args),
    validate: (...args) =>
      validate(gitAdapter, searchAdapter, repositoryCache, ...args),
  }
}
