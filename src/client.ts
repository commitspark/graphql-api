import { createApolloConfig } from './graphql/apollo-config-factory.ts'
import { generateSchema } from './graphql/schema-generator.ts'
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
import { RepositoryCacheHandler } from './persistence/cache.ts'

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
  repositoryCache: RepositoryCacheHandler,
  ref: string,
  request: ApolloExecuteOperationRequest<TData, TVariables>,
): Promise<GraphQLResponse<TData | null>> => {
  let currentHash = await gitAdapter.getLatestCommitHash(ref)
  const context: ApolloContext = {
    branch: ref,
    gitAdapter: gitAdapter,
    getCurrentHash(): string {
      return currentHash
    },
    setCurrentHash(refArg: string) {
      currentHash = refArg
    },
    repositoryCache: repositoryCache,
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
    ref: context.getCurrentHash(),
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
  repositoryCache: RepositoryCacheHandler,
  ref: string,
): Promise<SchemaResponse> => {
  let currentHash = await gitAdapter.getLatestCommitHash(ref)
  const context: ApolloContext = {
    branch: ref,
    gitAdapter: gitAdapter,
    getCurrentHash(): string {
      return currentHash
    },
    setCurrentHash(refArg: string) {
      currentHash = refArg
    },
    repositoryCache: repositoryCache,
  }

  const typeDefinitionStrings = (await generateSchema(context)).typeDefs
  if (!Array.isArray(typeDefinitionStrings)) {
    throw new Error('Expected array of typeDefinition strings.')
  }

  return {
    ref: context.getCurrentHash(),
    data: typeDefinitionStrings.join('\n'),
  }
}

export interface ApolloContext {
  branch: string
  gitAdapter: GitAdapter
  getCurrentHash(): string
  setCurrentHash(sha: string): void
  repositoryCache: RepositoryCacheHandler
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
