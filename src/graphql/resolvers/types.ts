import { ApolloContext } from '../../client'
import { GraphQLNamedType } from 'graphql/type'
import { GraphQLFieldResolver } from 'graphql'

export interface QueryMutationResolverContext extends ApolloContext {
  type: GraphQLNamedType
}

export type QueryMutationResolver<ResultType> = GraphQLFieldResolver<
  any,
  ApolloContext,
  any,
  Promise<ResultType>
>
