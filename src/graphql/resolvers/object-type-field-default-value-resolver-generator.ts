import {
  GraphQLField,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLSchema,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { resolveFieldDefaultValue } from './field-resolvers/field-default-value-resolver.ts'
import { ContextInjectionResolver } from './types.ts'

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
): GraphQLField<unknown, unknown>[] {
  const fields = []
  for (const fieldsKey in objectType.getFields()) {
    const field: GraphQLField<unknown, unknown> =
      objectType.getFields()[fieldsKey]
    if (requiresCustomDefaultValueResolver(field.type)) {
      fields.push(field)
    }
  }
  return fields
}

type RecordOfContextInjectionResolvers = Record<
  string,
  ContextInjectionResolver
>

export function createObjectTypeFieldResolvers(
  schema: GraphQLSchema,
): Record<string, RecordOfContextInjectionResolvers> {
  const adapterResolversByType: Record<
    string,
    RecordOfContextInjectionResolvers
  > = {}

  for (const typeName of Object.keys(schema.getTypeMap())) {
    const type = schema.getType(typeName)
    if (!isObjectType(type) || type.name.startsWith('__')) {
      continue
    }

    // only fields holding lists, unions or objects need a custom resolver
    const fieldsForCustomDefaultValueResolver =
      getFieldsForCustomDefaultValueResolver(type)

    const fieldResolversByFieldName: Record<string, ContextInjectionResolver> =
      {}
    for (const field of fieldsForCustomDefaultValueResolver) {
      // the resolvers created here serve as adapters to inject additional context information needed by actual field resolvers
      fieldResolversByFieldName[field.name] = (obj, args, context, info) => {
        // entries are validated before their data is returned, so field data matches the field's type
        return resolveFieldDefaultValue(
          (obj?.[field.name] ?? null) as Parameters<
            typeof resolveFieldDefaultValue
          >[0],
          args,
          {
            ...context,
            currentType: field.type,
          },
          info,
        )
      }
    }

    if (Object.keys(fieldResolversByFieldName).length > 0) {
      adapterResolversByType[typeName] = fieldResolversByFieldName
    }
  }

  return adapterResolversByType
}
