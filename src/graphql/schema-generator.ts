import {
  generateCommitInputType,
  generateQueriesAndMutations,
  generateEntryFields,
  generateSearchQuery,
  generateTypeNameQuery,
} from './queries-mutations-generator.ts'
import { IExecutableSchemaDefinition } from '@graphql-tools/schema'
import { analyzeSchema } from './schema-analyzer.ts'
import {
  generateIdInputTypeStrings,
  generateObjectInputTypeStrings,
  generateUnionInputTypeStrings,
} from './input-type-generator.ts'
import { generateSchemaRootTypeStrings } from './schema-root-type-generator.ts'
import { printSchemaWithDirectives } from '@graphql-tools/utils'
import { unionTypeResolver } from './resolvers/query-mutation-resolvers/union-type-resolver.ts'
import { RequestContext } from '../client.ts'
import { GraphQLTypeResolver } from 'graphql'
import { validateSchemaDefinition } from './schema-validator.ts'
import {
  MUTATION_TYPE_NAME,
  QUERY_TYPE_NAME,
} from './schema-utils/generated-names.ts'
import { createObjectTypeFieldResolvers } from './resolvers/object-type-field-resolver-generator.ts'
import { createError, ErrorCode } from './errors.ts'
import {
  EntryFieldResolver,
  QueryMutationResolver,
  QueryMutationResult,
  ReferencedByResolver,
  SearchQueryResolver,
  UnionTypeResolver,
  VersionResolver,
} from './resolvers/types.ts'

export async function generateSchema(
  context: RequestContext,
): Promise<IExecutableSchemaDefinition> {
  const originalSchemaString = await context.repositoryCache.getSchema(
    context,
    context.getCurrentHash(),
  )
  const { schema, problems } = validateSchemaDefinition(originalSchemaString)
  if (schema === undefined || problems.length > 0) {
    throw createError(`Invalid schema.`, ErrorCode.BAD_SCHEMA, {
      schema:
        schema !== undefined
          ? printSchemaWithDirectives(schema)
          : originalSchemaString,
      argumentValue: problems.join('\n'),
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
  const generatedSearchQuery =
    context.searchAdapter !== undefined ? generateSearchQuery() : undefined
  const generatedEntryFields = generateEntryFields(
    schemaAnalyzerResult.entryDirectiveTypes,
  )

  const generatedObjectInputTypeStrings = generateObjectInputTypeStrings(
    schemaAnalyzerResult.objectTypes,
  )

  const generatedUnionInputTypeStrings = generateUnionInputTypeStrings(
    schemaAnalyzerResult.unionTypes,
  )

  const generatedSchemaRootTypeStrings = generateSchemaRootTypeStrings(
    generatedQueriesMutations,
    generatedTypeNameQuery,
    generatedSearchQuery,
  )

  const generatedSchemaString = `schema {
  query: ${QUERY_TYPE_NAME}
  mutation: ${MUTATION_TYPE_NAME}
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
    QueryMutationResolver<QueryMutationResult> | SearchQueryResolver
  > = {}
  const generatedMutationResolvers: Record<
    string,
    QueryMutationResolver<QueryMutationResult>
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
  if (generatedSearchQuery !== undefined) {
    generatedQueryResolvers[generatedSearchQuery.name] =
      generatedSearchQuery.resolver
  }

  const allGeneratedResolvers: Record<
    string,
    | Record<
        string,
        | QueryMutationResolver<QueryMutationResult>
        | SearchQueryResolver
        | GraphQLTypeResolver<unknown, RequestContext>
        | EntryFieldResolver
        | ReferencedByResolver
        | VersionResolver
      >
    | UnionTypeResolverRecord
  > = {
    [QUERY_TYPE_NAME]: generatedQueryResolvers,
    [MUTATION_TYPE_NAME]: generatedMutationResolvers,
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
  for (const entryFields of generatedEntryFields) {
    allGeneratedResolvers[entryFields.typeName] = {
      ...(allGeneratedResolvers[entryFields.typeName] ?? {}),
      ...entryFields.resolvers,
    }
  }

  const typeDefs = [
    filteredOriginalSchemaString,
    generatedSchemaString,
    generateCommitInputType(),
    generatedIdInputTypeStrings.join('\n'),
    generatedObjectInputTypeStrings.join('\n'),
    generatedUnionInputTypeStrings.join('\n'),
    generatedEntryFields
      .map((entryFields) => entryFields.typeExtensionString)
      .join('\n'),
    generatedSearchQuery?.typeDefinitionString ?? '',
  ].filter((typeDef) => typeDef.length > 0)

  return {
    typeDefs: typeDefs,
    resolvers: allGeneratedResolvers,
  }
}

interface UnionTypeResolverRecord {
  __resolveType: UnionTypeResolver
}
