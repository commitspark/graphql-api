import {
  ApolloExecuteOperationRequest,
  getSchema,
  GraphQLResponse,
  postGraphQL,
  SchemaResponse,
  VariableValues,
} from './client'
import { GitAdapter } from '@commitspark/git-adapter'

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

export { Client, GraphQLResponse, SchemaResponse }

export async function createClient(gitAdapter: GitAdapter): Promise<Client> {
  return {
    postGraphQL: (ref, request) => postGraphQL(gitAdapter, ref, request),
    getSchema: (ref) => getSchema(gitAdapter, ref),
  }
}
