import { createApolloConfig } from './graphql/apollo-config-factory.ts'
import { generateSchema } from './graphql/schema-generator.ts'
import {
  DocumentNode,
  GraphQLFormattedError,
  TypedQueryDocumentNode,
} from 'graphql'
import { GitAdapter } from '@commitspark/git-adapter'
import { SearchAdapter } from '@commitspark/search-adapter'
import {
  ApolloServer,
  ApolloServerOptions,
  GraphQLRequest,
} from '@apollo/server'
import { RepositoryCacheHandler } from './persistence/cache.ts'
import { validateRepository } from './validation/repository-validator.ts'
import { ValidationResult } from './validation/violation.ts'
import { DataSourceContext } from './graphql/resolvers/entry-data-source.ts'

const createContext = async (
  gitAdapter: GitAdapter,
  searchAdapter: SearchAdapter | undefined,
  repositoryCache: RepositoryCacheHandler,
  ref: string,
): Promise<ApolloContext> => {
  let currentHash = await gitAdapter.getLatestCommitHash(ref)
  return {
    branch: ref,
    gitAdapter: gitAdapter,
    searchAdapter: searchAdapter,
    getCurrentHash(): string {
      return currentHash
    },
    setCurrentHash(refArg: string) {
      currentHash = refArg
    },
    repositoryCache: repositoryCache,
    dataSourceContexts: new WeakMap(),
  }
}

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
  searchAdapter: SearchAdapter | undefined,
  repositoryCache: RepositoryCacheHandler,
  ref: string,
  request: ApolloExecuteOperationRequest<TData, TVariables>,
): Promise<GraphQLResponse<TData | null>> => {
  const context = await createContext(
    gitAdapter,
    searchAdapter,
    repositoryCache,
    ref,
  )

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
  searchAdapter: SearchAdapter | undefined,
  repositoryCache: RepositoryCacheHandler,
  ref: string,
): Promise<SchemaResponse> => {
  const context = await createContext(
    gitAdapter,
    searchAdapter,
    repositoryCache,
    ref,
  )

  const typeDefinitionStrings = (await generateSchema(context)).typeDefs
  if (!Array.isArray(typeDefinitionStrings)) {
    throw new Error('Expected array of typeDefinition strings.')
  }

  return {
    ref: context.getCurrentHash(),
    data: typeDefinitionStrings.join('\n'),
  }
}

export const validate = async (
  gitAdapter: GitAdapter,
  searchAdapter: SearchAdapter | undefined,
  repositoryCache: RepositoryCacheHandler,
  ref: string,
): Promise<ValidationResult> => {
  const context = await createContext(
    gitAdapter,
    searchAdapter,
    repositoryCache,
    ref,
  )
  const violations = await validateRepository(context)
  return { ref: context.getCurrentHash(), violations }
}

export interface ApolloContext {
  branch: string
  gitAdapter: GitAdapter
  searchAdapter?: SearchAdapter
  getCurrentHash(): string
  setCurrentHash(sha: string): void
  repositoryCache: RepositoryCacheHandler
  /**
   * Information about the objects returned to GraphQL for entries during this request, keyed by these objects. It is
   * created per request, so that it can never be shared between requests.
   */
  dataSourceContexts: WeakMap<object, DataSourceContext>
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
