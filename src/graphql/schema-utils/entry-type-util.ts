import {
  GraphQLNullableType,
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

export function buildsOnTypeWithEntryDirective(
  type: GraphQLNullableType,
): boolean {
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
