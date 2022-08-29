import { ISchemaAnalyzerResult } from './schema-analyzer.service'
import { Injectable } from '@nestjs/common'
import { Entry, PersistenceService } from '../persistence/persistence.service'
import { IApolloContext } from '../app/api.service'

@Injectable()
export class QueriesMutationsGeneratorService {
  constructor(private readonly persistence: PersistenceService) {}

  public generateFromAnalyzedSchema(
    schemaAnalyzerResult: ISchemaAnalyzerResult,
  ): IGeneratedSchema[] {
    return schemaAnalyzerResult.entityDirectiveTypes.map(
      (objectType): IGeneratedSchema => {
        const name = objectType.name

        const queryAllName = `all${name}s`
        const queryAllString = `${queryAllName}: [${objectType.name}]`
        const queryAllResolver = async (
          obj,
          args,
          context: IApolloContext,
          info,
        ): Promise<Entry[]> => {
          return this.persistence.findByType(context.getCurrentRef(), name)
        }

        const queryAllMetaName = `_${queryAllName}Meta`
        const queryAllMetaString = `${queryAllMetaName}: ListMetadata`
        const queryAllMetaResolver = async (
          obj,
          args,
          context: IApolloContext,
          info,
        ): Promise<Entry> => {
          return {
            count: (
              await this.persistence.findByType(context.getCurrentRef(), name)
            ).length,
          }
        }

        const queryByIdName = name
        const queryByIdString = `${queryByIdName}(id: ID!): ${objectType.name}`
        const queryByIdResolver = async (
          obj,
          args,
          context,
          info,
        ): Promise<Entry> => {
          return this.persistence.findByTypeId(
            context.getCurrentRef(),
            name,
            args.id,
          )
        }

        const inputTypeName = `${name}Input`
        const createMutationName = `create${name}`
        const createMutationString = `${createMutationName}(data:${inputTypeName}, message:String): ${name}`
        const createMutationResolver = async (
          source,
          args,
          context: IApolloContext,
          info,
        ): Promise<Entry> => {
          // TODO validate ID references in payload to assert referenced ID exists and points to correct entry type
          const createResult = await this.persistence.createType(
            context.branch,
            name,
            args.data,
            args.message,
          )
          context.setCurrentRef(createResult.ref)
          return this.persistence.findByTypeId(
            context.getCurrentRef(),
            name,
            createResult.id,
          )
        }

        const updateMutationName = `update${name}`
        const updateMutationString = `${updateMutationName}(id: ID!, data:${inputTypeName}, message:String): ${name}`
        const updateMutationResolver = async (
          source,
          args,
          context: IApolloContext,
          info,
        ): Promise<Entry> => {
          // TODO validate ID references in payload to assert referenced ID exists and points to correct entry type
          const updateResult = await this.persistence.updateByTypeId(
            context.branch,
            name,
            args.id,
            args.data,
            args.message,
          )
          context.setCurrentRef(updateResult.ref)
          return this.persistence.findByTypeId(
            context.getCurrentRef(),
            name,
            args.id,
          )
        }

        const deleteMutationName = `delete${name}`
        const deleteMutationString = `${deleteMutationName}(id: ID!, message:String): DeletionResult`
        const deleteMutationResolver = async (
          source,
          args,
          context: IApolloContext,
          info,
        ): Promise<Entry> => {
          // TODO validate ID to delete is not referenced anywhere
          const deleteResult = await this.persistence.deleteByTypeId(
            context.branch,
            name,
            args.id,
            args.data,
            args.message,
          )
          context.setCurrentRef(deleteResult.ref)
          return {
            id: args.id,
          }
        }

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
      },
    )
  }

  public generateTypeQuery(): IGeneratedQuery<Promise<string>> {
    const contentTypeQueryName = '_typeName'
    const contentTypeQueryString = `${contentTypeQueryName}(id: ID!): String`
    const contentTypeQueryResolver = async (
      source,
      args,
      context: IApolloContext,
      info,
    ): Promise<string> => {
      return this.persistence.getTypeById(context.branch, args.id)
    }

    return {
      name: contentTypeQueryName,
      schemaString: contentTypeQueryString,
      resolver: contentTypeQueryResolver,
    }
  }
}

export interface IGeneratedSchema {
  queryAll: IGeneratedQuery<Promise<Entry[]>>
  queryAllMeta: IGeneratedQuery<Promise<Entry>>
  queryById: IGeneratedQuery<Promise<Entry>>
  createMutation: IGeneratedQuery<Promise<Entry>>
  updateMutation: IGeneratedQuery<Promise<Entry>>
  deleteMutation: IGeneratedQuery<Promise<Entry>>
}

export interface IGeneratedQuery<T> {
  name: string
  schemaString: string
  resolver: (obj, args, context: IApolloContext, info) => T
}
