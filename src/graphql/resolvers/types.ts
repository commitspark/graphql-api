import { ApolloContext } from '../../client.ts'
import {
  GraphQLFieldResolver,
  GraphQLNamedType,
  GraphQLTypeResolver,
} from 'graphql'
import { EntryData } from '@commitspark/git-adapter'
import { RecursiveArray } from './field-resolvers/types.ts'

export interface QueryMutationResolverContext extends ApolloContext {
  type: GraphQLNamedType
}

export type QueryMutationResolver<ResultType> = GraphQLFieldResolver<
  unknown,
  QueryMutationResolverContext,
  { id: string; data?: EntryData; commitMessage: string },
  Promise<ResultType>
>

export type UnionTypeResolver = GraphQLTypeResolver<
  UnionTypeResolverSourceData,
  ApolloContext
>

type UnionTypeResolverSourceData = EntryData & {
  id?: string
  __typename: string
}

export type ContextInjectionResolver = GraphQLFieldResolver<
  EntryData,
  ApolloContext,
  Record<string, unknown>,
  Promise<RecursiveArray<EntryData>>
>
