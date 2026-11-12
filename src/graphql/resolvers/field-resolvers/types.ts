import { GraphQLFieldResolver, GraphQLOutputType } from 'graphql'
import { EntryData } from '@commitspark/git-adapter'
import { ApolloContext } from '../../../client.ts'

interface FieldResolverContext extends ApolloContext {
  currentType: GraphQLOutputType
  hasNonNullParent?: boolean
}

type FieldResolverSource = EntryData | EntryData[]

export type FieldResolver<
  TSource = FieldResolverSource,
  TContext = FieldResolverContext,
  TArgs = Record<string, unknown>,
  TResult = Promise<ResolvedValue>,
> = GraphQLFieldResolver<TSource, TContext, TArgs, TResult>

/**
 * Value returned by field resolvers. Elements of lists may be promises, so that GraphQL completes every element on its
 * own and applies the nullability of the element type to errors of single elements.
 */
export type ResolvedValue =
  EntryData | null | Array<ResolvedValue | Promise<ResolvedValue>>
