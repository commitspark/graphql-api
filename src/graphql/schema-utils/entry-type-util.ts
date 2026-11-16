import {
  GraphQLObjectType,
  GraphQLType,
  GraphQLUnionType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { ENTRY_DIRECTIVE_NAME, hasDirective } from './directive-util.ts'

export function isUnionOfEntryTypes(type: GraphQLUnionType): boolean {
  return type
    .getTypes()
    .every((unionType) => buildsOnTypeWithEntryDirective(unionType))
}

export function buildsOnTypeWithEntryDirective(type: GraphQLType): boolean {
  if (isNonNullType(type)) {
    return buildsOnTypeWithEntryDirective(type.ofType)
  } else if (isListType(type)) {
    return buildsOnTypeWithEntryDirective(type.ofType)
  } else if (isUnionType(type)) {
    return isUnionOfEntryTypes(type)
  } else if (isObjectType(type)) {
    return hasDirective(type, ENTRY_DIRECTIVE_NAME)
  }
  return false
}

/**
 * Returns the object type of a field whose values are merged into the stored value by update mutations, i.e. of a
 * field holding a single embedded object (no list, no union, no reference to an entry).
 */
export function getMergedObjectType(
  type: GraphQLType,
): GraphQLObjectType | undefined {
  const nullableType = isNonNullType(type) ? type.ofType : type
  if (
    isObjectType(nullableType) &&
    !hasDirective(nullableType, ENTRY_DIRECTIVE_NAME)
  ) {
    return nullableType
  }
  return undefined
}
