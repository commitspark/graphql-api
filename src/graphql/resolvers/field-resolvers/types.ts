import { GraphQLFieldResolver, GraphQLOutputType } from 'graphql'
import { EntryData } from '@commitspark/git-adapter'
import { ApolloContext } from '../../../client.ts'

export interface FieldResolverContext extends ApolloContext {
  currentType: GraphQLOutputType
  hasNonNullParent?: boolean
}

export type FieldResolverSource = EntryData | EntryData[]

export type FieldResolver<
  TSource = FieldResolverSource,
  TContext = FieldResolverContext,
  TArgs = Record<string, unknown>,
  TResult = Promise<RecursiveArray<EntryData>>,
> = GraphQLFieldResolver<TSource, TContext, TArgs, TResult>

export type RecursiveArray<T> = T | Array<RecursiveArray<T>>
