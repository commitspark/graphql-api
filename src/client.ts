import { createApolloConfig } from './graphql/apollo-config-factory'
import { generateSchema } from './graphql/schema-generator'
import {
  DocumentNode,
  GraphQLFormattedError,
  TypedQueryDocumentNode,
} from 'graphql'
import { GitAdapter } from '@commitspark/git-adapter'
import {
  ApolloServer,
  ApolloServerOptions,
  GraphQLRequest,
} from '@apollo/server'

export type VariableValues = { [name: string]: unknown }

export type ApolloExecuteOperationRequest<
  TData = Record<string, unknown>,
  TVariables extends VariableValues = VariableValues,
> = Omit<GraphQLRequest<TVariables>, 'query'> & {
  query?: string | DocumentNode | TypedQueryDocumentNode<TData, TVariables>
}

export const postGraphQL = async <
  TData = Record<string, unknown>,
  TVariables extends VariableValues = VariableValues,
>(
  gitAdapter: GitAdapter,
  ref: string,
  request: ApolloExecuteOperationRequest<TData, TVariables>,
): Promise<GraphQLResponse<TData | null>> => {
  let currentRef = await gitAdapter.getLatestCommitHash(ref)
  const context: ApolloContext = {
    branch: ref,
    gitAdapter: gitAdapter,
    getCurrentRef(): string {
      return currentRef
    },
    setCurrentRef(refArg: string) {
      currentRef = refArg
    },
  }

  const apolloDriverConfig: ApolloServerOptions<ApolloContext> =
    await createApolloConfig(context)

  const apolloServer = new ApolloServer<ApolloContext>({
    ...apolloDriverConfig,
  })

  const result = await apolloServer.executeOperation<TData, TVariables>(
    request,
    {
      contextValue: context,
    },
  )

  await apolloServer.stop()

  return {
    ref: context.getCurrentRef(),
    data:
      result.body.kind === 'single' ? result.body.singleResult.data : undefined,
    errors:
      result.body.kind === 'single'
        ? result.body.singleResult.errors
        : undefined,
  }
}

export const getSchema = async (
  gitAdapter: GitAdapter,
  ref: string,
): Promise<SchemaResponse> => {
  let currentRef = await gitAdapter.getLatestCommitHash(ref)
  const context: ApolloContext = {
    branch: ref,
    gitAdapter: gitAdapter,
    getCurrentRef(): string {
      return currentRef
    },
    setCurrentRef(refArg: string) {
      currentRef = refArg
    },
  }

  const typeDefinitionStrings = (await generateSchema(context)).typeDefs
  if (!Array.isArray(typeDefinitionStrings)) {
    throw new Error('Unknown element')
  }

  return {
    ref: context.getCurrentRef(),
    data: typeDefinitionStrings.join('\n'),
  }
}

export interface ApolloContext {
  branch: string
  gitAdapter: GitAdapter
  getCurrentRef(): string
  setCurrentRef(sha: string): void
}

export interface GraphQLResponse<TData> {
  ref: string
  data?: TData
  errors: ReadonlyArray<GraphQLFormattedError> | undefined
}

export interface SchemaResponse {
  ref: string
  data: string
}
