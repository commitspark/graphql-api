import {
  GraphQLFieldResolver,
  GraphQLNullableType,
  GraphQLUnionType,
} from 'graphql/type/definition'
import { ApolloContext } from '../../app/api.service'
import { Entry } from '../../persistence/persistence.service'
import { GraphQLSchema, Kind } from 'graphql'
import {
  GraphQLField,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from 'graphql/type'
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
      if (!type || type.astNode?.kind !== Kind.OBJECT_TYPE_DEFINITION) {
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
    if (type instanceof GraphQLNonNull) {
      return this.buildsOnUnionType(type.ofType)
    } else if (type instanceof GraphQLList) {
      return this.buildsOnUnionType(type.ofType)
    } else if (type instanceof GraphQLUnionType) {
      return true
    } else if (type instanceof GraphQLObjectType) {
      return false
    }
    return false
  }

  private collapseTypeField(
    type: GraphQLNullableType,
    fieldValue: Record<string, any> | Record<string, any>[] | null,
  ): Record<string, any> | null {
    if (type instanceof GraphQLNonNull) {
      return this.collapseTypeField(type.ofType, fieldValue)
    } else if (fieldValue === null) {
      return null
    } else if (type instanceof GraphQLList) {
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
