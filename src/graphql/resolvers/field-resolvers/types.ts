import { GraphQLFieldResolver } from 'graphql/type/definition'
import { EntryData, GitAdapter } from '@commitspark/git-adapter'
import { GraphQLOutputType } from 'graphql'

export interface FieldResolverContext {
  gitAdapter: GitAdapter
  getCurrentRef(): string
  currentType: GraphQLOutputType
  hasNonNullParent?: boolean
}

export type FieldResolver<
  TSource,
  TContext = FieldResolverContext,
  TArgs = any,
  TResult = Promise<ResolvedEntryData<EntryData | EntryData[] | null>>,
> = GraphQLFieldResolver<TSource, TContext, TArgs, TResult>

export type ResolvedEntryData<T> = T | Array<ResolvedEntryData<T>>
