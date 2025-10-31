import {
  GraphQLNullableType,
  GraphQLObjectType,
  GraphQLUnionType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'

export function hasEntryDirective(type: GraphQLObjectType): boolean {
  return (
    !!type.astNode &&
    type.astNode.directives?.find(
      (directive) => directive.name.value === 'Entry',
    ) !== undefined
  )
}

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
    return hasEntryDirective(type)
  }
  return false
}
