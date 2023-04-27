import { Entry } from '../persistence/persistence.service'
import { ApolloContext } from '../app/api.service'
import { GraphQLFieldResolver } from 'graphql/type/definition'
import { GraphQLObjectType } from 'graphql/type'
import { QueryAllResolverGenerator } from './resolver-generators/query-all-resolver-generator'
import { QueryByIdResolverGenerator } from './resolver-generators/query-by-id-resolver-generator'
import { MutationCreateResolverGenerator } from './resolver-generators/mutation-create-resolver-generator'
import { MutationUpdateResolverGenerator } from './resolver-generators/mutation-update.resolver-generator'
import { MutationDeleteResolverGenerator } from './resolver-generators/mutation-delete-resolver-generator'
import { QueryCountAllResolverGenerator } from './resolver-generators/query-count-all-resolver-generator'
import { QueryTypeByIdResolverGenerator } from './resolver-generators/query-type-by-id-resolver-generator'

export class QueriesMutationsGeneratorService {
  constructor(
    private readonly queryAllResolverGenerator: QueryAllResolverGenerator,
    private readonly queryByIdResolverGenerator: QueryByIdResolverGenerator,
    private readonly queryCountAllResolverGenerator: QueryCountAllResolverGenerator,
    private readonly queryTypeByIdResolverGenerator: QueryTypeByIdResolverGenerator,
    private readonly mutationCreateResolverGenerator: MutationCreateResolverGenerator,
    private readonly mutationUpdateResolverGenerator: MutationUpdateResolverGenerator,
    private readonly mutationDeleteResolverGenerator: MutationDeleteResolverGenerator,
  ) {}

  public generateFromAnalyzedSchema(
    entryDirectiveTypes: GraphQLObjectType[],
  ): IGeneratedSchema[] {
    return entryDirectiveTypes.map((objectType): IGeneratedSchema => {
      const typeName = objectType.name

      const queryAllName = `all${typeName}s`
      const queryAllString = `${queryAllName}: [${objectType.name}]`
      const queryAllResolver: GraphQLFieldResolver<
        any,
        ApolloContext,
        any,
        Promise<Entry[]>
      > = this.queryAllResolverGenerator.createResolver(typeName)

      const queryAllMetaName = `_${queryAllName}Meta`
      const queryAllMetaString = `${queryAllMetaName}: ListMetadata`
      const queryAllMetaResolver: GraphQLFieldResolver<
        any,
        ApolloContext,
        any,
        Promise<TypeCount>
      > = this.queryCountAllResolverGenerator.createResolver(typeName)

      const queryByIdName = typeName
      const queryByIdString = `${queryByIdName}(id: ID!): ${objectType.name}`
      const queryByIdResolver: GraphQLFieldResolver<
        any,
        ApolloContext,
        any,
        Promise<Entry>
      > = this.queryByIdResolverGenerator.createResolver(typeName)

      const inputTypeName = `${typeName}Input`
      const createMutationName = `create${typeName}`
      const createMutationString = `${createMutationName}(data:${inputTypeName}, message:String): ${typeName}`
      const createMutationResolver: GraphQLFieldResolver<
        any,
        ApolloContext,
        any,
        Promise<Entry>
      > = this.mutationCreateResolverGenerator.createResolver(typeName)

      const updateMutationName = `update${typeName}`
      const updateMutationString = `${updateMutationName}(id: ID!, data:${inputTypeName}, message:String): ${typeName}`
      const updateMutationResolver: GraphQLFieldResolver<
        any,
        ApolloContext,
        any,
        Promise<Entry>
      > = this.mutationUpdateResolverGenerator.createResolver(typeName)

      const deleteMutationName = `delete${typeName}`
      const deleteMutationString = `${deleteMutationName}(id: ID!, message:String): DeletionResult`
      const deleteMutationResolver: GraphQLFieldResolver<
        any,
        ApolloContext,
        any,
        Promise<Entry>
      > = this.mutationDeleteResolverGenerator.createResolver(typeName)

      return {
        queryAll: {
          name: queryAllName,
          schemaString: queryAllString,
          resolver: queryAllResolver,
        },
        queryAllMeta: {
          name: queryAllMetaName,
          schemaString: queryAllMetaString,
          resolver: queryAllMetaResolver,
        },
        queryById: {
          name: queryByIdName,
          schemaString: queryByIdString,
          resolver: queryByIdResolver,
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

  public generateTypeNameQuery(): IGeneratedQuery<Promise<string>> {
    const contentTypeQueryName = '_typeName'
    const contentTypeQueryString = `${contentTypeQueryName}(id: ID!): String`
    const contentTypeQueryResolver: GraphQLFieldResolver<
      any,
      ApolloContext,
      any,
      Promise<string>
    > = this.queryTypeByIdResolverGenerator.createResolver()

    return {
      name: contentTypeQueryName,
      schemaString: contentTypeQueryString,
      resolver: contentTypeQueryResolver,
    }
  }
}

export interface IGeneratedSchema {
  queryAll: IGeneratedQuery<Promise<Entry[]>>
  queryAllMeta: IGeneratedQuery<Promise<TypeCount>>
  queryById: IGeneratedQuery<Promise<Entry>>
  createMutation: IGeneratedQuery<Promise<Entry>>
  updateMutation: IGeneratedQuery<Promise<Entry>>
  deleteMutation: IGeneratedQuery<Promise<Entry>>
}

export interface IGeneratedQuery<T> {
  name: string
  schemaString: string
  resolver: GraphQLFieldResolver<any, ApolloContext, any, T>
}

export type TypeCount = {
  count: number
}
