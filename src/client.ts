import { generateSchema } from './graphql/schema-generator.ts'
import {
  DocumentNode,
  GraphQLFormattedError,
  TypedQueryDocumentNode,
} from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { GitAdapter } from '@commitspark/git-adapter'
import { SearchAdapter } from '@commitspark/search-adapter'
import { executeRequest } from './graphql/request-executor.ts'
import { RepositoryCacheHandler } from './persistence/cache.ts'
import { validateRepository } from './validation/repository-validator.ts'
import { ValidationResult } from './validation/violation.ts'
import { DataSourceContext } from './graphql/resolvers/entry-data-source.ts'
import { callGitAdapter } from './persistence/git-adapter-call.ts'

const createContext = async (
  gitAdapter: GitAdapter,
  searchAdapter: SearchAdapter | undefined,
  repositoryCache: RepositoryCacheHandler,
  ref: string,
): Promise<RequestContext> => {
  let currentHash = await callGitAdapter(() =>
    gitAdapter.getLatestCommitHash(ref),
  )
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

export interface GraphQLRequest<
  TData = Record<string, unknown>,
  TVariables extends VariableValues = VariableValues,
> {
  /**
   * The GraphQL document, as string or parsed.
   */
  query: string | DocumentNode | TypedQueryDocumentNode<TData, TVariables>
  /**
   * The operation to execute; required if the document contains more than one operation.
   */
  operationName?: string | null
  variables?: TVariables | null
}

export const postGraphQL = async <
  TData = Record<string, unknown>,
  TVariables extends VariableValues = VariableValues,
>(
  gitAdapter: GitAdapter,
  searchAdapter: SearchAdapter | undefined,
  repositoryCache: RepositoryCacheHandler,
  ref: string,
  request: GraphQLRequest<TData, TVariables>,
): Promise<GraphQLResponse<TData | null>> => {
  const context = await createContext(
    gitAdapter,
    searchAdapter,
    repositoryCache,
    ref,
  )

  const schema = makeExecutableSchema(await generateSchema(context))
  const result = await executeRequest<TData>(
    schema,
    request.query,
    request.variables,
    request.operationName,
    context,
  )

  return {
    ref: context.getCurrentHash(),
    data: result.data,
    errors: result.errors,
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

export interface RequestContext {
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
