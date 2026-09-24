import {
  getNamedType,
  GraphQLSchema,
  GraphQLUnionType,
  isObjectType,
  isScalarType,
  Kind,
} from 'graphql'
import {
  hasSearchableDirective,
  SEARCHABLE_DIRECTIVE_NAME,
} from './schema-utils/searchable-field-util.ts'

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
      (innerType) =>
        !!innerType.astNode &&
        innerType.astNode.directives?.find(
          (directive) => directive.name.value === 'Entry',
        ) !== undefined,
    ).length

    if (
      numberUnionMembersWithEntryDirective !== 0 &&
      numberUnionMembersWithEntryDirective !== innerTypes.length
    ) {
      return `Either all union members of "${type.name}" must have "@Entry" directive or none.`
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
      if (!hasSearchableDirective(field)) {
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
