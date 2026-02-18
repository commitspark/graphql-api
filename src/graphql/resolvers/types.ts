import { ApolloContext } from '../../client.ts'
import { GraphQLFieldResolver, GraphQLNamedType } from 'graphql'

export interface QueryMutationResolverContext extends ApolloContext {
  type: GraphQLNamedType
}

export type QueryMutationResolver<ResultType> = GraphQLFieldResolver<
  any,
  ApolloContext,
  any,
  Promise<ResultType>
>
