import { GraphQLSchema, isObjectType } from 'graphql'
import { resolveFieldValue } from './field-resolvers/field-value-resolver.ts'
import { getDataSourceContext } from './entry-data-source.ts'
import { EntryFieldResolver } from './types.ts'

/**
 * Creates a resolver for every field of the object types defined in the user's schema. The resolvers read field
 * values from entry data and report violations of the entry data at the field or list element they concern.
 */
export function createObjectTypeFieldResolvers(
  schema: GraphQLSchema,
): Record<string, Record<string, EntryFieldResolver>> {
  const resolversByType: Record<string, Record<string, EntryFieldResolver>> = {}

  for (const type of Object.values(schema.getTypeMap())) {
    if (!isObjectType(type) || type.name.startsWith('__')) {
      continue
    }

    const resolversByField: Record<string, EntryFieldResolver> = {}
    for (const field of Object.values(type.getFields())) {
      resolversByField[field.name] = (source, _args, context, info) => {
        const sourceContext = getDataSourceContext(context, source)
        return resolveFieldValue(
          source[field.name],
          field.type,
          sourceContext,
          [...sourceContext.path, field.name],
          context,
          info,
        )
      }
    }
    resolversByType[type.name] = resolversByField
  }

  return resolversByType
}
