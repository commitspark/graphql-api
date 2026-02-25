import {
  generateQueriesAndMutations,
  generateTypeNameQuery,
} from './queries-mutations-generator.ts'
import {
  IExecutableSchemaDefinition,
  makeExecutableSchema,
} from '@graphql-tools/schema'
import { analyzeSchema } from './schema-analyzer.ts'
import {
  generateIdInputTypeStrings,
  generateObjectInputTypeStrings,
  generateUnionInputTypeStrings,
} from './input-type-generator.ts'
import { generateSchemaRootTypeStrings } from './schema-root-type-generator.ts'
import { printSchemaWithDirectives } from '@graphql-tools/utils'
import { unionTypeResolver } from './resolvers/query-mutation-resolvers/union-type-resolver.ts'
import { ApolloContext } from '../client.ts'
import { GraphQLTypeResolver } from 'graphql'
import { getValidationResult } from './schema-validator.ts'
import { createObjectTypeFieldResolvers } from './resolvers/object-type-field-default-value-resolver-generator.ts'
import { createError, ErrorCode } from './errors.ts'
import { FieldResolver } from './resolvers/field-resolvers/types.ts'
import {
  ContextInjectionResolver,
  QueryMutationResolver,
  UnionTypeResolver,
} from './resolvers/types.ts'
import { EntryData } from '@commitspark/git-adapter'

export async function generateSchema(
  context: ApolloContext,
): Promise<IExecutableSchemaDefinition> {
  const originalSchemaString = await context.repositoryCache.getSchema(
    context,
    context.getCurrentHash(),
  )
  const schema = makeExecutableSchema({
    typeDefs: originalSchemaString,
  })

  const validationResult = getValidationResult(schema)
  if (validationResult.length > 0) {
    throw createError(`Invalid schema.`, ErrorCode.BAD_SCHEMA, {
      schema: printSchemaWithDirectives(schema),
      argumentValue: validationResult.join('\n'),
    })
  }
  const schemaAnalyzerResult = analyzeSchema(schema)

  const filteredOriginalSchemaString = printSchemaWithDirectives(schema) + '\n'

  const generatedIdInputTypeStrings =
    generateIdInputTypeStrings(schemaAnalyzerResult)

  const generatedQueriesMutations = generateQueriesAndMutations(
    schemaAnalyzerResult.entryDirectiveTypes,
  )
  const generatedTypeNameQuery = generateTypeNameQuery()

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

  const generatedSchemaString = `schema {
  query: Query
  mutation: Mutation
}

${generatedSchemaRootTypeStrings}`

  const generatedUnionTypeResolvers: Record<
    string,
    { __resolveType: UnionTypeResolver }
  > = {}
  for (const unionType of schemaAnalyzerResult.unionTypes) {
    generatedUnionTypeResolvers[unionType.name] = {
      __resolveType: unionTypeResolver,
    }
  }
  const generatedObjectTypeFieldResolvers =
    createObjectTypeFieldResolvers(schema)

  const generatedQueryResolvers: Record<
    string,
    QueryMutationResolver<EntryData | EntryData[] | string>
  > = {}
  const generatedMutationResolvers: Record<
    string,
    QueryMutationResolver<EntryData | EntryData[] | string>
  > = {}

  for (const element of generatedQueriesMutations) {
    generatedQueryResolvers[element.queryEvery.name] =
      element.queryEvery.resolver
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
    | Record<
        string,
        | QueryMutationResolver<EntryData | EntryData[] | string>
        | GraphQLTypeResolver<unknown, ApolloContext>
        | ContextInjectionResolver
        | FieldResolver
      >
    | UnionTypeResolverRecord
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

interface UnionTypeResolverRecord {
  __resolveType: UnionTypeResolver
}
