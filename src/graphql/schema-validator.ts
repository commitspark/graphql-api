import {
  getNamedType,
  GraphQLSchema,
  GraphQLUnionType,
  isObjectType,
  isScalarType,
  Kind,
} from 'graphql'
import {
  ENTRY_DIRECTIVE_NAME,
  hasDirective,
  SEARCHABLE_DIRECTIVE_NAME,
} from './schema-utils/directive-util.ts'

function checkUnionMembersConsistentUseOfEntryDirective(
  schema: GraphQLSchema,
): string {
  const typeMap = schema.getTypeMap()

  for (const type of Object.values(typeMap)) {
    if (type.astNode?.kind !== Kind.UNION_TYPE_DEFINITION) {
      continue
    }
    const innerTypes = (type as GraphQLUnionType).getTypes()

    const numberUnionMembersWithEntryDirective = innerTypes.filter(
      (innerType) => hasDirective(innerType, ENTRY_DIRECTIVE_NAME),
    ).length

    if (
      numberUnionMembersWithEntryDirective !== 0 &&
      numberUnionMembersWithEntryDirective !== innerTypes.length
    ) {
      return `Either all union members of "${type.name}" must have "@${ENTRY_DIRECTIVE_NAME}" directive or none.`
    }
  }

  return ''
}

function checkSearchableDirectiveOnlyOnStringFields(
  schema: GraphQLSchema,
): string {
  for (const type of Object.values(schema.getTypeMap())) {
    if (!isObjectType(type) || type.name.startsWith('__')) {
      continue
    }
    for (const field of Object.values(type.getFields())) {
      if (!hasDirective(field, SEARCHABLE_DIRECTIVE_NAME)) {
        continue
      }
      const namedType = getNamedType(field.type)
      if (!isScalarType(namedType) || namedType.name !== 'String') {
        return `Field "${type.name}.${field.name}" must be of type "String" or a list of "String" to use "@${SEARCHABLE_DIRECTIVE_NAME}" directive.`
      }
    }
  }

  return ''
}

export function getValidationResult(schema: GraphQLSchema): string[] {
  const results = []
  results.push(checkUnionMembersConsistentUseOfEntryDirective(schema))
  results.push(checkSearchableDirectiveOnlyOnStringFields(schema))
  return results.filter((result) => result !== '')
}
