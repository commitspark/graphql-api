import { EntryData } from '@commitspark/git-adapter'
import { GraphQLObjectType } from 'graphql'
import { queryEveryResolver } from './resolvers/query-mutation-resolvers/query-every-resolver.ts'
import { queryByIdResolver } from './resolvers/query-mutation-resolvers/query-by-id-resolver.ts'
import { mutationCreateResolver } from './resolvers/query-mutation-resolvers/mutation-create-resolver.ts'
import { mutationUpdateResolver } from './resolvers/query-mutation-resolvers/mutation-update-resolver.ts'
import { mutationDeleteResolver } from './resolvers/query-mutation-resolvers/mutation-delete-resolver.ts'
import { queryTypeByIdResolver } from './resolvers/query-mutation-resolvers/query-type-by-id-resolver.ts'
import { querySearchResolver } from './resolvers/query-mutation-resolvers/query-search-resolver.ts'
import { referencedByResolver } from './resolvers/field-resolvers/referenced-by-resolver.ts'
import { versionResolver } from './resolvers/field-resolvers/version-resolver.ts'
import {
  QueryMutationResolver,
  ReferencedByResolver,
  SearchQueryResolver,
  VersionResolver,
} from './resolvers/types.ts'
import * as names from './schema-utils/generated-names.ts'

export function generateQueriesAndMutations(
  entryDirectiveTypes: GraphQLObjectType[],
): GeneratedSchema[] {
  return entryDirectiveTypes.map((objectType): GeneratedSchema => {
    const typeName = objectType.name

    const queryEveryName = names.queryEveryName(typeName)
    const queryEveryString = `${queryEveryName}: [${objectType.name}!]`
    const queryEveryResolverFunc: QueryMutationResolver<EntryData[]> = (
      source,
      args,
      context,
      info,
    ) =>
      queryEveryResolver(source, args, { ...context, type: objectType }, info)

    const queryByIdName = names.queryByIdName(typeName)
    const queryByIdString = `${queryByIdName}(id: ID!): ${objectType.name}`
    const queryByIdResolverFunc: QueryMutationResolver<EntryData> = (
      source,
      args,
      context,
      info,
    ) => queryByIdResolver(source, args, { ...context, type: objectType }, info)

    const inputTypeName = names.inputTypeName(typeName)
    // mutations are printed with one argument per line, as indented within the generated root type
    const commitArgument = (operation: string): string =>
      '    """\n' +
      `    Details of the commit. If no message is given, the message is '${operation} ${typeName} "<id>"'.\n` +
      '    """\n' +
      `    commit: ${names.COMMIT_INPUT_TYPE_NAME}\n`
    const expectedVersionArgument =
      '    """\n' +
      '    Version of the entry (field `_version`) that the change is based on. If given and the entry has a different\n' +
      '    version, the mutation fails with error code CONFLICT instead of overwriting changes made since.\n' +
      '    """\n' +
      '    expectedVersion: String\n'
    const createMutationName = names.createMutationName(typeName)
    const createMutationString = `${createMutationName}(\n    id: ID!\n    data: ${inputTypeName}!\n${commitArgument('Create')}  ): ${typeName}`
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

    const updateMutationName = names.updateMutationName(typeName)
    const updateMutationString = `${updateMutationName}(\n    id: ID!\n    data: ${inputTypeName}!\n${expectedVersionArgument}${commitArgument('Update')}  ): ${typeName}`
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

    const deleteMutationName = names.deleteMutationName(typeName)
    const deleteMutationString = `${deleteMutationName}(\n    id: ID!\n${expectedVersionArgument}${commitArgument('Delete')}  ): ID`
    const deleteMutationResolver: QueryMutationResolver<string> = (
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
      queryEvery: {
        name: queryEveryName,
        schemaString: queryEveryString,
        resolver: queryEveryResolverFunc,
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

export function generateCommitInputType(): string {
  return `"""
Details of the commit created by a mutation.
"""
input ${names.COMMIT_INPUT_TYPE_NAME} {
  """
  Commit message summarizing the change in a single line. Leading and trailing whitespace is removed, and messages
  containing line breaks are rejected with error code BAD_USER_INPUT. If omitted or empty, a message is generated.
  """
  message: String
  """
  Optional details of the change, which may span multiple lines. Leading and trailing whitespace is removed.
  """
  body: String
}
`
}

export function generateTypeNameQuery(): GeneratedQuery {
  const entryTypeQueryName = names.TYPE_NAME_QUERY_NAME
  const entryTypeQueryString = `${entryTypeQueryName}(id: ID!): String!`

  return {
    name: entryTypeQueryName,
    schemaString: entryTypeQueryString,
    resolver: queryTypeByIdResolver,
  }
}

export function generateSearchQuery(): GeneratedSearchQuery {
  const searchQueryName = names.SEARCH_QUERY_NAME
  const searchHitTypeName = names.SEARCH_HIT_TYPE_NAME

  return {
    name: searchQueryName,
    schemaString: `${searchQueryName}(query: String!, types: [String!], first: Int): [${searchHitTypeName}!]!`,
    typeDefinitionString: `type ${searchHitTypeName} {
  entryId: ID!
  entryType: String!
  fieldPath: String!
  score: Float!
  snippet: String!
}
`,
    resolver: querySearchResolver,
  }
}

export function generateEntryFields(
  entryDirectiveTypes: GraphQLObjectType[],
): GeneratedEntryFields[] {
  const referencedByFieldName = names.REFERENCED_BY_FIELD_NAME
  const versionFieldName = names.VERSION_FIELD_NAME

  return entryDirectiveTypes.map((objectType) => ({
    typeName: objectType.name,
    typeExtensionString: `extend type ${objectType.name} {
  ${referencedByFieldName}: [ID!]!
  """
  Version of the entry, which changes whenever the stored entry changes. Pass it as \`expectedVersion\` to update
  and delete mutations to prevent overwriting changes made since the entry was read.
  """
  ${versionFieldName}: String!
}
`,
    resolvers: {
      [referencedByFieldName]: referencedByResolver,
      [versionFieldName]: versionResolver,
    },
  }))
}

interface GeneratedEntryFields {
  typeName: string
  typeExtensionString: string
  resolvers: Record<string, ReferencedByResolver | VersionResolver>
}

export interface GeneratedSearchQuery {
  name: string
  schemaString: string
  typeDefinitionString: string
  resolver: SearchQueryResolver
}

export interface GeneratedSchema {
  queryEvery: GeneratedQuery
  queryById: GeneratedQuery
  createMutation: GeneratedQuery
  updateMutation: GeneratedQuery
  deleteMutation: GeneratedQuery
}

export interface GeneratedQuery {
  name: string
  schemaString: string
  resolver: QueryMutationResolver<EntryData | EntryData[] | string>
}
