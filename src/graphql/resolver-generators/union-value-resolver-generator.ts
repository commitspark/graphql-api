import { GraphQLFieldResolver } from 'graphql/type/definition'
import { ApolloContext } from '../../app/api.service'
import { Entry } from '../../persistence/persistence.service'
import {
  GraphQLField,
  GraphQLNullableType,
  GraphQLObjectType,
  GraphQLSchema,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { EntryReferenceUtil } from '../schema-utils/entry-reference-util'

export class UnionValueResolverGenerator {
  constructor(private readonly entryReferenceUtil: EntryReferenceUtil) {}

  public createResolver(
    schema: GraphQLSchema,
  ): Record<
    string,
    Record<string, GraphQLFieldResolver<any, ApolloContext, any, Entry | null>>
  > {
    const resolvers: Record<
      string,
      Record<
        string,
        GraphQLFieldResolver<any, ApolloContext, any, Entry | null>
      >
    > = {}
    for (const typeName of Object.keys(schema.getTypeMap())) {
      const type = schema.getType(typeName)
      if (!isObjectType(type)) {
        continue
      }
      const objectType = type as GraphQLObjectType
      const unionFieldsNotUsingEntry =
        this.getFieldsWithUnionTypeNotUsingEntryTypes(objectType)

      const fieldResolvers: Record<
        string,
        GraphQLFieldResolver<any, ApolloContext, any, Entry | null>
      > = {}
      for (const field of unionFieldsNotUsingEntry) {
        fieldResolvers[field.name] = (
          obj,
          args,
          context,
          info,
        ): Entry | null => {
          const fieldValue = obj[info.fieldName]
          return this.collapseTypeField(field.type, fieldValue)
        }
      }

      if (Object.keys(fieldResolvers).length > 0) {
        resolvers[typeName] = fieldResolvers
      }
    }

    return resolvers
  }

  private getFieldsWithUnionTypeNotUsingEntryTypes(
    objectType: GraphQLObjectType,
  ): GraphQLField<any, any>[] {
    const fields = []
    for (const fieldsKey in objectType.getFields()) {
      const field: GraphQLField<any, any> = objectType.getFields()[fieldsKey]
      if (
        this.buildsOnUnionType(field.type) &&
        !this.entryReferenceUtil.buildsOnTypeWithEntryDirective(field.type)
      ) {
        fields.push(field)
      }
    }
    return fields
  }

  private buildsOnUnionType(type: GraphQLNullableType): boolean {
    if (isNonNullType(type)) {
      return this.buildsOnUnionType(type.ofType)
    } else if (isListType(type)) {
      return this.buildsOnUnionType(type.ofType)
    } else if (isUnionType(type)) {
      return true
    } else if (isObjectType(type)) {
      return false
    }
    return false
  }

  private collapseTypeField(
    type: GraphQLNullableType,
    fieldValue: Record<string, any> | Record<string, any>[] | null,
  ): Record<string, any> | null {
    if (isNonNullType(type)) {
      return this.collapseTypeField(type.ofType, fieldValue)
    } else if (fieldValue === null) {
      return null
    } else if (isListType(type)) {
      if (!Array.isArray(fieldValue)) {
        throw new Error('Expected array value')
      }
      return fieldValue.map((item) => this.collapseTypeField(type.ofType, item))
    } else {
      // Based on our @oneOf directive, we expect only one field whose name
      // corresponds to the concrete type's name.
      const firstKey = Object.keys(fieldValue)[0]
      if (Array.isArray(fieldValue)) {
        throw new Error('Did not expect array value')
      }

      // We replace the above name field that nests our concrete data directly
      // with the data and a `__typename` field, so that our output data
      // corresponds to the output schema provided by the user (i.e. there is
      // no additional nesting level there).
      return {
        ...fieldValue[firstKey],
        __typename: firstKey.slice(0, 1).toUpperCase() + firstKey.slice(1),
      }
    }
  }
}
