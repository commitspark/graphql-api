import {
  GraphQLNullableType,
  GraphQLObjectType,
  GraphQLUnionType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'

export class EntryTypeUtil {
  public buildsOnTypeWithEntryDirective(type: GraphQLNullableType): boolean {
    if (isNonNullType(type)) {
      return this.buildsOnTypeWithEntryDirective(type.ofType)
    } else if (isListType(type)) {
      return this.buildsOnTypeWithEntryDirective(type.ofType)
    } else if (isUnionType(type)) {
      return this.isUnionOfEntryTypes(type)
    } else if (isObjectType(type)) {
      return this.hasEntryDirective(type)
    }
    return false
  }

  public hasEntryDirective(type: GraphQLObjectType): boolean {
    return (
      !!type.astNode &&
      type.astNode.directives?.find(
        (directive) => directive.name.value === 'Entry',
      ) !== undefined
    )
  }

  public isUnionOfEntryTypes(type: GraphQLUnionType): boolean {
    return (
      type
        .getTypes()
        .filter((unionType) => this.buildsOnTypeWithEntryDirective(unionType))
        .length > 0
    )
  }
}
