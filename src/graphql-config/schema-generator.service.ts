import { Injectable } from '@nestjs/common'
import {
  IGeneratedSchema,
  QueriesMutationsGeneratorService,
} from './queries-mutations-generator.service'
import {
  IExecutableSchemaDefinition,
  makeExecutableSchema,
} from '@graphql-tools/schema'
import { SchemaAnalyzerService } from './schema-analyzer.service'
import { InputTypeGeneratorService } from './input-type-generator.service'
import { SchemaRootTypeGeneratorService } from './schema-root-type-generator.service'
import { QueryApiService } from '../git/gitlab/query-api.service'
import { printSchemaWithDirectives } from '@graphql-tools/utils'
import { EntryReferenceResolverGeneratorService } from './entry-reference-resolver-generator.service'
import { UnionTypeResolverGeneratorService } from './union-type-resolver-generator-service'
import { IApolloContext } from '../app/api.service'

@Injectable()
export class SchemaGeneratorService {
  constructor(
    private readonly queriesMutationsGenerator: QueriesMutationsGeneratorService,
    private readonly schemaAnalyzer: SchemaAnalyzerService,
    private readonly inputTypeGenerator: InputTypeGeneratorService,
    private readonly schemaRootTypeGenerator: SchemaRootTypeGeneratorService,
    private readonly queryApi: QueryApiService,
    private readonly entryReferenceResolverGenerator: EntryReferenceResolverGeneratorService,
    private readonly unionTypeResolverGenerator: UnionTypeResolverGeneratorService,
  ) {}

  public async generateSchema(
    context: IApolloContext,
  ): Promise<IExecutableSchemaDefinition> {
    const originalSchemaString = await this.queryApi.getSchema(
      context.getCurrentRef(),
    )
    let schema = makeExecutableSchema({
      typeDefs: originalSchemaString,
    })

    const schemaAnalyzerResult = this.schemaAnalyzer.analyzeSchema(schema)

    const filteredOriginalSchemaString = printSchemaWithDirectives(schema)

    const generatedIdInputTypeStrings =
      this.inputTypeGenerator.generateIdInputTypeStrings(schemaAnalyzerResult)

    const generatedQueriesMutations =
      this.queriesMutationsGenerator.generateFromAnalyzedSchema(
        schemaAnalyzerResult,
      )
    let generatedEntryReferenceResolvers = {}
    schemaAnalyzerResult.typesWithEntryReferences.forEach((obj) => {
      generatedEntryReferenceResolvers = {
        ...generatedEntryReferenceResolvers,
        ...this.entryReferenceResolverGenerator.createResolver(context, obj),
      }
    })

    const generatedObjectInputTypeStrings =
      this.inputTypeGenerator.generateObjectInputTypeStrings(
        schemaAnalyzerResult,
      )

    const generatedSchemaRootTypeStrings =
      this.schemaRootTypeGenerator.generateSchemaRootTypeStrings(
        generatedQueriesMutations,
      )

    const generatedSchemaString =
      'schema {\n  query: Query\n  mutation: Mutation\n}\n\n' +
      generatedSchemaRootTypeStrings +
      '\n' +
      'type ListMetadata {\n' +
      '  count: Int!\n' +
      '}\n\n' +
      'type DeletionResult {\n' +
      '  id: ID\n' +
      '}\n'

    const generatedUnionTypeResolvers = {}
    schemaAnalyzerResult.unionTypes.forEach((elem): void => {
      generatedUnionTypeResolvers[elem.name] =
        this.unionTypeResolverGenerator.createResolver()
    })

    const generatedQueryResolvers = {}
    const generatedMutationResolvers = {}
    generatedQueriesMutations.forEach(function (
      element: IGeneratedSchema,
    ): void {
      generatedQueryResolvers[element.queryAllName] = element.queryAllResolver
      generatedQueryResolvers[element.queryAllMetaName] =
        element.queryAllMetaResolver
      generatedQueryResolvers[element.queryByIdName] = element.queryByIdResolver
      generatedMutationResolvers[element.createMutationName] =
        element.createMutationResolver
      generatedMutationResolvers[element.updateMutationName] =
        element.updateMutationResolver
      generatedMutationResolvers[element.deleteMutationName] =
        element.deleteMutationResolver
    })

    return {
      typeDefs: [
        filteredOriginalSchemaString,
        generatedSchemaString,
        generatedIdInputTypeStrings.join('\n'),
        generatedObjectInputTypeStrings.join('\n'),
      ],
      resolvers: {
        Query: generatedQueryResolvers,
        Mutation: generatedMutationResolvers,
        ...generatedUnionTypeResolvers,
        ...generatedEntryReferenceResolvers,
      },
    }
  }
}
