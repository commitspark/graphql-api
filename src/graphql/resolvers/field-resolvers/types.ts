import { GraphQLFieldResolver } from 'graphql/type/definition'
import { EntryData } from '@commitspark/git-adapter'
import { GraphQLOutputType } from 'graphql'
import { ApolloContext } from '../../../client'

export interface FieldResolverContext extends ApolloContext {
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
