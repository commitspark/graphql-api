import {
  ApolloExecuteOperationRequest,
  getSchema,
  GraphQLResponse,
  postGraphQL,
  SchemaResponse,
  VariableValues,
} from './client'
import { GitAdapter } from '@commitspark/git-adapter'
import { ErrorCode, ErrorMetadata } from './graphql/errors'
import { createCacheHandler } from './persistence/cache'

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

export { Client, GraphQLResponse, SchemaResponse, ErrorCode, ErrorMetadata }

export async function createClient(gitAdapter: GitAdapter): Promise<Client> {
  const repositoryCache = createCacheHandler()
  return {
    postGraphQL: (...args) => postGraphQL(gitAdapter, repositoryCache, ...args),
    getSchema: (...args) => getSchema(gitAdapter, repositoryCache, ...args),
  }
}
