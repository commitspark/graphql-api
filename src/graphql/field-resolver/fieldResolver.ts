import { GraphQLFieldResolver } from 'graphql/type/definition'
import { EntryData, GitAdapter } from '@commitspark/git-adapter'

export interface FieldResolverContext {
  gitAdapter: GitAdapter
  getCurrentRef(): string
}

export interface FieldResolver<
  TSource,
  TContext = FieldResolverContext,
  TArgs = any,
  TResult = Promise<ResolvedEntryData<EntryData | EntryData[] | null>>,
> {
  resolve: GraphQLFieldResolver<TSource, TContext, TArgs, TResult>
}

export type ResolvedEntryData<T> = T | Array<ResolvedEntryData<T>>
