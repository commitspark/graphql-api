import {
  ApolloExecuteOperationRequest,
  getSchema,
  GraphQLResponse,
  postGraphQL,
  SchemaResponse,
  VariableValues,
} from './client.ts'
import { GitAdapter } from '@commitspark/git-adapter'
import { SearchAdapter } from '@commitspark/search-adapter'
import { ErrorCode, ErrorMetadata } from './graphql/errors.ts'
import { createCacheHandler } from './persistence/cache.ts'

interface Client {
  postGraphQL<
    TData = Record<string, unknown>,
    TVariables extends VariableValues = VariableValues,
  >(
    ref: string,
    request: ApolloExecuteOperationRequest<TData, TVariables>,
  ): Promise<GraphQLResponse<TData | null>>
  getSchema(ref: string): Promise<SchemaResponse>
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
  }
}
