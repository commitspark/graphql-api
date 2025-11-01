import {
  GraphQLField,
  GraphQLFieldResolver,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLSchema,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { EntryData } from '@commitspark/git-adapter'
import { ResolvedEntryData } from './field-resolvers/types'
import { resolveFieldDefaultValue } from './field-resolvers/field-default-value-resolver'
import { ApolloContext } from '../../client'

function requiresCustomDefaultValueResolver(type: GraphQLOutputType): boolean {
  if (isNonNullType(type)) {
    return requiresCustomDefaultValueResolver(type.ofType)
  } else if (isListType(type)) {
    return true
  } else if (isUnionType(type)) {
    return true
  } else if (isObjectType(type)) {
    return true
  }
  return false
}

function getFieldsForCustomDefaultValueResolver(
  objectType: GraphQLObjectType,
): GraphQLField<any, any>[] {
  const fields = []
  for (const fieldsKey in objectType.getFields()) {
    const field: GraphQLField<any, any> = objectType.getFields()[fieldsKey]
    if (requiresCustomDefaultValueResolver(field.type)) {
      fields.push(field)
    }
  }
  return fields
}

type FieldResolversRecord = Record<
  string,
  GraphQLFieldResolver<
    any,
    ApolloContext,
    any,
    Promise<ResolvedEntryData<EntryData | EntryData[] | null>>
  >
>

export function createObjectTypeFieldResolvers(
  schema: GraphQLSchema,
): Record<string, FieldResolversRecord> {
  const fieldResolversByType: Record<string, FieldResolversRecord> = {}
  for (const typeName of Object.keys(schema.getTypeMap())) {
    const type = schema.getType(typeName)
    if (!isObjectType(type) || type.name.startsWith('__')) {
      continue
    }
    const fieldsForCustomDefaultValueResolver =
      getFieldsForCustomDefaultValueResolver(type)

    const fieldResolversByFieldName: FieldResolversRecord = {}
    for (const field of fieldsForCustomDefaultValueResolver) {
      fieldResolversByFieldName[field.name] = (
        obj,
        args,
        context,
        info,
      ): Promise<ResolvedEntryData<EntryData | EntryData[] | null>> =>
        resolveFieldDefaultValue(
          field.name in obj ? obj[field.name] : undefined,
          args,
          {
            currentType: field.type,
            gitAdapter: context.gitAdapter,
            getCurrentRef: context.getCurrentRef,
          },
          info,
        )
    }

    if (Object.keys(fieldResolversByFieldName).length > 0) {
      fieldResolversByType[typeName] = fieldResolversByFieldName
    }
  }

  return fieldResolversByType
}
