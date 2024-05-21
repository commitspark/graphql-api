import { QueriesMutationsGeneratorService } from './queries-mutations-generator.service'
import {
  IExecutableSchemaDefinition,
  makeExecutableSchema,
} from '@graphql-tools/schema'
import { SchemaAnalyzerService } from './schema-analyzer.service'
import { InputTypeGeneratorService } from './input-type-generator.service'
import { SchemaRootTypeGeneratorService } from './schema-root-type-generator.service'
import { printSchemaWithDirectives } from '@graphql-tools/utils'
import { UnionTypeResolverGenerator } from './resolver-generators/union-type-resolver-generator'
import { ApolloContext } from '../app/api.service'
import {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from 'graphql/type/definition'
import { SchemaValidator } from './schema-validator'
import { Entry } from '../persistence/persistence.service'
import { ObjectTypeFieldDefaultValueResolverGenerator } from './resolver-generators/object-type-field-default-value-resolver-generator'

export class SchemaGeneratorService {
  constructor(
    private readonly queriesMutationsGenerator: QueriesMutationsGeneratorService,
    private readonly schemaAnalyzer: SchemaAnalyzerService,
    private readonly inputTypeGenerator: InputTypeGeneratorService,
    private readonly schemaRootTypeGenerator: SchemaRootTypeGeneratorService,
    private readonly unionTypeResolverGenerator: UnionTypeResolverGenerator,
    private readonly objectTypeFieldDefaultValueResolverGenerator: ObjectTypeFieldDefaultValueResolverGenerator,
    private readonly schemaValidator: SchemaValidator,
  ) {}

  public async generateSchema(
    context: ApolloContext,
  ): Promise<IExecutableSchemaDefinition> {
    const originalSchemaString = await context.gitAdapter.getSchema(
      context.getCurrentRef(),
    )
    const schema = makeExecutableSchema({
      typeDefs: originalSchemaString,
    })

    const validationResult = this.schemaValidator.getValidationResult(schema)
    if (validationResult.length > 0) {
      throw new Error(validationResult.join('\n'))
    }
    const schemaAnalyzerResult = this.schemaAnalyzer.analyzeSchema(schema)

    const filteredOriginalSchemaString =
      printSchemaWithDirectives(schema) + '\n'

    const generatedIdInputTypeStrings =
      this.inputTypeGenerator.generateIdInputTypeStrings(schemaAnalyzerResult)

    const generatedQueriesMutations =
      this.queriesMutationsGenerator.generateFromAnalyzedSchema(
        schemaAnalyzerResult.entryDirectiveTypes,
      )
    const generatedTypeNameQuery =
      this.queriesMutationsGenerator.generateTypeNameQuery()

    const generatedEntryReferenceResolvers: Record<
      string,
      Record<
        string,
        GraphQLFieldResolver<
          Record<string, any>,
          ApolloContext,
          any,
          Promise<Entry | Entry[] | null>
        >
      >
    > = {}

    const generatedObjectInputTypeStrings =
      this.inputTypeGenerator.generateObjectInputTypeStrings(
        schemaAnalyzerResult.objectTypes,
      )

    const generatedUnionInputTypeStrings =
      this.inputTypeGenerator.generateUnionInputTypeStrings(
        schemaAnalyzerResult.unionTypes,
      )

    const generatedSchemaRootTypeStrings =
      this.schemaRootTypeGenerator.generateSchemaRootTypeStrings(
        generatedQueriesMutations,
        generatedTypeNameQuery,
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

    const generatedUnionTypeResolvers: Record<string, UnionTypeResolver> = {}
    for (const unionType of schemaAnalyzerResult.unionTypes) {
      generatedUnionTypeResolvers[unionType.name] = {
        __resolveType: this.unionTypeResolverGenerator.createResolver(),
      }
    }
    const generatedObjectTypeFieldDefaultValueResolvers =
      this.objectTypeFieldDefaultValueResolverGenerator.createResolver(schema)

    const generatedQueryResolvers: Record<
      string,
      GraphQLFieldResolver<any, ApolloContext>
    > = {}
    const generatedMutationResolvers: Record<
      string,
      GraphQLFieldResolver<any, ApolloContext>
    > = {}

    for (const element of generatedQueriesMutations) {
      generatedQueryResolvers[element.queryAll.name] = element.queryAll.resolver
      generatedQueryResolvers[element.queryAllMeta.name] =
        element.queryAllMeta.resolver
      generatedQueryResolvers[element.queryById.name] =
        element.queryById.resolver
      generatedMutationResolvers[element.createMutation.name] =
        element.createMutation.resolver
      generatedMutationResolvers[element.updateMutation.name] =
        element.updateMutation.resolver
      generatedMutationResolvers[element.deleteMutation.name] =
        element.deleteMutation.resolver
    }
    generatedQueryResolvers[generatedTypeNameQuery.name] =
      generatedTypeNameQuery.resolver

    const allGeneratedResolvers: Record<
      string,
      Record<
        string,
        | GraphQLFieldResolver<any, ApolloContext>
        | GraphQLTypeResolver<any, ApolloContext>
      >
    > = {
      Query: generatedQueryResolvers,
      Mutation: generatedMutationResolvers,
    }

    for (const typeName of Object.keys(generatedUnionTypeResolvers)) {
      allGeneratedResolvers[typeName] = {
        ...(allGeneratedResolvers[typeName] ?? {}),
        ...generatedUnionTypeResolvers[typeName],
      }
    }
    for (const typeName of Object.keys(
      generatedObjectTypeFieldDefaultValueResolvers,
    )) {
      allGeneratedResolvers[typeName] = {
        ...(allGeneratedResolvers[typeName] ?? {}),
        ...generatedObjectTypeFieldDefaultValueResolvers[typeName],
      }
    }
    for (const typeName of Object.keys(generatedEntryReferenceResolvers)) {
      allGeneratedResolvers[typeName] = {
        ...(allGeneratedResolvers[typeName] ?? {}),
        ...generatedEntryReferenceResolvers[typeName],
      }
    }

    const typeDefs = [
      filteredOriginalSchemaString,
      generatedSchemaString,
      generatedIdInputTypeStrings.join('\n'),
      generatedObjectInputTypeStrings.join('\n'),
      generatedUnionInputTypeStrings.join('\n'),
    ].filter((typeDef) => typeDef.length > 0)

    return {
      typeDefs: typeDefs,
      resolvers: allGeneratedResolvers,
    }
  }
}

interface UnionTypeResolver {
  __resolveType: GraphQLTypeResolver<any, ApolloContext>
}
