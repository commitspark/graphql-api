import { EntryData } from '@commitspark/git-adapter'
import { ApolloContext } from '../app/client'
import { GraphQLFieldResolver, GraphQLObjectType } from 'graphql'
import { queryAllResolver } from './resolvers/query-mutation-resolvers/query-all-resolver'
import { queryByIdResolver } from './resolvers/query-mutation-resolvers/query-by-id-resolver'
import { mutationCreateResolver } from './resolvers/query-mutation-resolvers/mutation-create-resolver'
import { mutationUpdateResolver } from './resolvers/query-mutation-resolvers/mutation-update-resolver'
import { mutationDeleteResolver } from './resolvers/query-mutation-resolvers/mutation-delete-resolver'
import { queryCountAllResolver } from './resolvers/query-mutation-resolvers/query-count-all-resolver'
import { queryTypeByIdResolver } from './resolvers/query-mutation-resolvers/query-type-by-id-resolver'
import { QueryMutationResolver } from './resolvers/types'

export function generateQueriesAndMutations(
  entryDirectiveTypes: GraphQLObjectType[],
): GeneratedSchema[] {
  return entryDirectiveTypes.map((objectType): GeneratedSchema => {
    const typeName = objectType.name

    const queryAllName = `all${typeName}s`
    const queryAllString = `${queryAllName}: [${objectType.name}!]`
    const queryAllResolverFunc: GraphQLFieldResolver<
      any,
      ApolloContext,
      any,
      Promise<EntryData[]>
    > = (source, args, context, info) =>
      queryAllResolver(source, args, { ...context, type: objectType }, info)

    const queryAllMetaName = `_${queryAllName}Meta`
    const queryAllMetaString = `${queryAllMetaName}: ListMetadata`
    const queryAllMetaResolverFunc: QueryMutationResolver<TypeCount> = (
      source,
      args,
      context,
      info,
    ) =>
      queryCountAllResolver(
        source,
        args,
        { ...context, type: objectType },
        info,
      )

    const queryByIdName = typeName
    const queryByIdString = `${queryByIdName}(id: ID!): ${objectType.name}`
    const queryByIdResolverFunc: QueryMutationResolver<EntryData> = (
      source,
      args,
      context,
      info,
    ) => queryByIdResolver(source, args, { ...context, type: objectType }, info)

    const inputTypeName = `${typeName}Input`
    const createMutationName = `create${typeName}`
    const createMutationString = `${createMutationName}(id: ID!, data: ${inputTypeName}!, commitMessage: String): ${typeName}`
    const createMutationResolver: QueryMutationResolver<EntryData> = (
      source,
      args,
      context,
      info,
    ) =>
      mutationCreateResolver(
        source,
        args,
        { ...context, type: objectType },
        info,
      )

    const updateMutationName = `update${typeName}`
    const updateMutationString = `${updateMutationName}(id: ID!, data: ${inputTypeName}!, commitMessage: String): ${typeName}`
    const updateMutationResolver: QueryMutationResolver<EntryData> = (
      source,
      args,
      context,
      info,
    ) =>
      mutationUpdateResolver(
        source,
        args,
        { ...context, type: objectType },
        info,
      )

    const deleteMutationName = `delete${typeName}`
    const deleteMutationString = `${deleteMutationName}(id: ID!, commitMessage: String): ID`
    const deleteMutationResolver: QueryMutationResolver<EntryData> = (
      source,
      args,
      context,
      info,
    ) =>
      mutationDeleteResolver(
        source,
        args,
        { ...context, type: objectType },
        info,
      )

    return {
      queryAll: {
        name: queryAllName,
        schemaString: queryAllString,
        resolver: queryAllResolverFunc,
      },
      queryAllMeta: {
        name: queryAllMetaName,
        schemaString: queryAllMetaString,
        resolver: queryAllMetaResolverFunc,
      },
      queryById: {
        name: queryByIdName,
        schemaString: queryByIdString,
        resolver: queryByIdResolverFunc,
      },
      createMutation: {
        name: createMutationName,
        schemaString: createMutationString,
        resolver: createMutationResolver,
      },
      updateMutation: {
        name: updateMutationName,
        schemaString: updateMutationString,
        resolver: updateMutationResolver,
      },
      deleteMutation: {
        name: deleteMutationName,
        schemaString: deleteMutationString,
        resolver: deleteMutationResolver,
      },
    }
  })
}

export function generateTypeNameQuery(): GeneratedQuery<Promise<string>> {
  const entryTypeQueryName = '_typeName'
  const entryTypeQueryString = `${entryTypeQueryName}(id: ID!): String!`

  return {
    name: entryTypeQueryName,
    schemaString: entryTypeQueryString,
    resolver: queryTypeByIdResolver,
  }
}

export interface GeneratedSchema {
  queryAll: GeneratedQuery<Promise<EntryData[]>>
  queryAllMeta: GeneratedQuery<Promise<TypeCount>>
  queryById: GeneratedQuery<Promise<EntryData>>
  createMutation: GeneratedQuery<Promise<EntryData>>
  updateMutation: GeneratedQuery<Promise<EntryData>>
  deleteMutation: GeneratedQuery<Promise<EntryData>>
}

export interface GeneratedQuery<T> {
  name: string
  schemaString: string
  resolver: GraphQLFieldResolver<any, ApolloContext, any, T>
}

export type TypeCount = {
  count: number
}
