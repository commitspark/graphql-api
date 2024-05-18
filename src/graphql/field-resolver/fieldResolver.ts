import { GraphQLFieldResolver } from 'graphql/type/definition'
import { Entry } from '../../persistence/persistence.service'
import { GitAdapter } from '@commitspark/git-adapter'

export interface FieldResolverContext {
  gitAdapter: GitAdapter
  getCurrentRef(): string
}

export interface FieldResolver<
  TSource,
  TContext = FieldResolverContext,
  TArgs = any,
  TResult = Promise<ResolvedEntryData<Entry | Entry[] | null>>,
> {
  resolve: GraphQLFieldResolver<TSource, TContext, TArgs, TResult>
}

export type ResolvedEntryData<T> = T | Array<ResolvedEntryData<T>>
