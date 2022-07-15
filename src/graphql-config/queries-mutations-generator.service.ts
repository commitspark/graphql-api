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
          queryAllName,
          queryAllString,
          queryAllResolver,
          queryAllMetaName,
          queryAllMetaString,
          queryAllMetaResolver,
          queryByIdName,
          queryByIdString,
          queryByIdResolver,
          createMutationName,
          createMutationString,
          createMutationResolver,
          updateMutationName,
          updateMutationString,
          updateMutationResolver,
          deleteMutationName,
          deleteMutationString,
          deleteMutationResolver,
        }
      },
    )
  }
}

export interface IGeneratedSchema {
  queryAllName: string
  queryAllString: string
  queryAllResolver: (obj, args, context, info) => Promise<Entry[]>
  queryAllMetaName: string
  queryAllMetaString: string
  queryAllMetaResolver: (obj, args, context, info) => Promise<Entry>
  queryByIdName: string
  queryByIdString: string
  queryByIdResolver: (obj, args, context, info) => Promise<Entry>
  createMutationName: string
  createMutationString: string
  createMutationResolver: (source, args, context, info) => Promise<Entry>
  updateMutationName: string
  updateMutationString: string
  updateMutationResolver: (source, args, context, info) => Promise<Entry>
  deleteMutationName: string
  deleteMutationString: string
  deleteMutationResolver: (source, args, context, info) => Promise<Entry>
}
