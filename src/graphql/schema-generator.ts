import {
  generateQueriesAndMutations,
  generateTypeNameQuery,
} from './queries-mutations-generator'
import {
  IExecutableSchemaDefinition,
  makeExecutableSchema,
} from '@graphql-tools/schema'
import { analyzeSchema } from './schema-analyzer'
import {
  generateIdInputTypeStrings,
  generateObjectInputTypeStrings,
  generateUnionInputTypeStrings,
} from './input-type-generator'
import { generateSchemaRootTypeStrings } from './schema-root-type-generator'
import { printSchemaWithDirectives } from '@graphql-tools/utils'
import { unionTypeResolver } from './resolvers/query-mutation-resolvers/union-type-resolver'
import { ApolloContext } from '../app/api.service'
import { GraphQLFieldResolver, GraphQLTypeResolver } from 'graphql'
import { getValidationResult } from './schema-validator'
import { EntryData } from '@commitspark/git-adapter'
import { createObjectTypeFieldResolvers } from './resolvers/object-type-field-default-value-resolver-generator'

export async function generateSchema(
  context: ApolloContext,
): Promise<IExecutableSchemaDefinition> {
  const originalSchemaString = await context.gitAdapter.getSchema(
    context.getCurrentRef(),
  )
  const schema = makeExecutableSchema({
    typeDefs: originalSchemaString,
  })

  const validationResult = getValidationResult(schema)
  if (validationResult.length > 0) {
    throw new Error(validationResult.join('\n'))
  }
  const schemaAnalyzerResult = analyzeSchema(schema)

  const filteredOriginalSchemaString = printSchemaWithDirectives(schema) + '\n'

  const generatedIdInputTypeStrings =
    generateIdInputTypeStrings(schemaAnalyzerResult)

  const generatedQueriesMutations = generateQueriesAndMutations(
    schemaAnalyzerResult.entryDirectiveTypes,
  )
  const generatedTypeNameQuery = generateTypeNameQuery()

  const generatedEntryReferenceResolvers: Record<
    string,
    Record<
      string,
      GraphQLFieldResolver<
        Record<string, any>,
        ApolloContext,
        any,
        Promise<EntryData | EntryData[] | null>
      >
    >
  > = {}

  const generatedObjectInputTypeStrings = generateObjectInputTypeStrings(
    schemaAnalyzerResult.objectTypes,
  )

  const generatedUnionInputTypeStrings = generateUnionInputTypeStrings(
    schemaAnalyzerResult.unionTypes,
  )

  const generatedSchemaRootTypeStrings = generateSchemaRootTypeStrings(
    generatedQueriesMutations,
    generatedTypeNameQuery,
  )

  const generatedSchemaString =
    'schema {\n  query: Query\n  mutation: Mutation\n}\n\n' +
    generatedSchemaRootTypeStrings +
    '\n' +
    'type ListMetadata {\n' +
    '  count: Int!\n' +
    '}\n'

  const generatedUnionTypeResolvers: Record<string, UnionTypeResolver> = {}
  for (const unionType of schemaAnalyzerResult.unionTypes) {
    generatedUnionTypeResolvers[unionType.name] = {
      __resolveType: unionTypeResolver,
    }
  }
  const generatedObjectTypeFieldResolvers =
    createObjectTypeFieldResolvers(schema)

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
    generatedQueryResolvers[element.queryById.name] = element.queryById.resolver
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
  for (const typeName of Object.keys(generatedObjectTypeFieldResolvers)) {
    allGeneratedResolvers[typeName] = {
      ...(allGeneratedResolvers[typeName] ?? {}),
      ...generatedObjectTypeFieldResolvers[typeName],
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

interface UnionTypeResolver {
  __resolveType: GraphQLTypeResolver<any, ApolloContext>
}
