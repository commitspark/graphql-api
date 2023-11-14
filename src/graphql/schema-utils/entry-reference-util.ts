import {
  GraphQLField,
  GraphQLNullableType,
  GraphQLObjectType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'

export class EntryReferenceUtil {
  public getFieldsWithReferenceToTypeWithEntryDirective(
    objectType: GraphQLObjectType,
  ): GraphQLField<any, any>[] {
    const fields = []
    for (const fieldsKey in objectType.getFields()) {
      const field: GraphQLField<any, any> = objectType.getFields()[fieldsKey]
      if (this.buildsOnTypeWithEntryDirective(field.type)) {
        fields.push(field)
      }
    }
    return fields
  }

  public buildsOnTypeWithEntryDirective(type: GraphQLNullableType): boolean {
    if (isNonNullType(type)) {
      return this.buildsOnTypeWithEntryDirective(type.ofType)
    } else if (isListType(type)) {
      return this.buildsOnTypeWithEntryDirective(type.ofType)
    } else if (isUnionType(type)) {
      return (
        type
          .getTypes()
          .filter((unionType) => this.buildsOnTypeWithEntryDirective(unionType))
          .length > 0
      )
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
}
