import {
  GraphQLField,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from 'graphql/type'
import { GraphQLNullableType, GraphQLUnionType } from 'graphql/type/definition'

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
    if (type instanceof GraphQLNonNull) {
      return this.buildsOnTypeWithEntryDirective(type.ofType)
    } else if (type instanceof GraphQLList) {
      return this.buildsOnTypeWithEntryDirective(type.ofType)
    } else if (type instanceof GraphQLUnionType) {
      return (
        type
          .getTypes()
          .filter((unionType) => this.buildsOnTypeWithEntryDirective(unionType))
          .length > 0
      )
    } else if (type instanceof GraphQLObjectType) {
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
