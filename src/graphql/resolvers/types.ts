import { ApolloContext } from '../../client.ts'
import {
  GraphQLFieldResolver,
  GraphQLNamedType,
  GraphQLTypeResolver,
} from 'graphql'
import { EntryData } from '@commitspark/git-adapter'
import { SearchHit } from '@commitspark/search-adapter'
import { ResolvedValue } from './field-resolvers/types.ts'

export interface CommitInput {
  message?: string | null
  body?: string | null
}

interface QueryMutationResolverContext extends ApolloContext {
  type: GraphQLNamedType
}

/**
 * Result of a generated query or mutation: an entry, the entries of a list as separate promises, or an ID or type name.
 */
export type QueryMutationResult = EntryData | Promise<EntryData>[] | string

export type QueryMutationResolver<ResultType> = GraphQLFieldResolver<
  unknown,
  QueryMutationResolverContext,
  {
    id: string
    data?: EntryData
    commit?: CommitInput | null
    expectedVersion?: string | null
  },
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

export type SearchQueryResolver = GraphQLFieldResolver<
  unknown,
  ApolloContext,
  { query: string; types?: string[] | null; first?: number | null },
  Promise<SearchHit[]>
>

export type EntryFieldResolver = GraphQLFieldResolver<
  Record<string, unknown>,
  ApolloContext,
  Record<string, unknown>,
  ResolvedValue | Promise<ResolvedValue>
>

export type ReferencedByResolver = GraphQLFieldResolver<
  EntryData & { id: string },
  ApolloContext,
  Record<string, never>,
  Promise<string[]>
>

export type VersionResolver = GraphQLFieldResolver<
  EntryData & { id: string },
  ApolloContext,
  Record<string, never>,
  Promise<string>
>
