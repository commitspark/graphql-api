import {
  GraphQLField,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql'
import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils'
import {
  GraphQLInterfaceType,
  GraphQLNullableType,
  GraphQLUnionType,
} from 'graphql/type/definition'
import { Injectable } from '@nestjs/common'

@Injectable()
export class SchemaAnalyzerService {
  public analyzeSchema(schema: GraphQLSchema): ISchemaAnalyzerResult {
    const result: ISchemaAnalyzerResult = {
      entityDirectiveTypes: [],
      objectTypes: [],
      interfaceTypes: [],
      unionTypes: [],
      typesWithEntryReferences: [],
    }

    mapSchema(schema, {
      [MapperKind.OBJECT_TYPE]: (
        objectType: GraphQLObjectType,
      ): GraphQLObjectType => {
        const entityDirective = getDirective(schema, objectType, 'Entry')?.[0]
        result.objectTypes.push(objectType)
        if (entityDirective) {
          result.entityDirectiveTypes.push(objectType)
        }
        const fieldsWithEntryReference =
          this.getFieldsWithReferenceToTypeWithEntryDirective(objectType)
        if (fieldsWithEntryReference.length > 0) {
          result.typesWithEntryReferences.push({
            type: objectType,
            fields: fieldsWithEntryReference,
          })
        }
        return objectType
      },
      [MapperKind.INTERFACE_TYPE]: (interfaceType) => {
        result.interfaceTypes.push(interfaceType)
        return interfaceType
      },
      [MapperKind.UNION_TYPE]: (unionType) => {
        result.unionTypes.push(unionType)
        return unionType
      },
    })

    return result
  }

  private getFieldsWithReferenceToTypeWithEntryDirective(
    objectType: GraphQLObjectType,
  ): GraphQLField<any, any>[] {
    const fields = []
    for (const fieldsKey in objectType.getFields()) {
      const field: GraphQLField<any, any> = objectType.getFields()[fieldsKey]
      if (this.hasReferenceToTypeWithEntryDirective(field.type)) {
        fields.push(field)
      }
    }
    return fields
  }

  private hasReferenceToTypeWithEntryDirective(
    type: GraphQLNullableType,
  ): boolean {
    if (type instanceof GraphQLNonNull) {
      return this.hasReferenceToTypeWithEntryDirective(type.ofType)
    } else if (type instanceof GraphQLList) {
      return this.hasReferenceToTypeWithEntryDirective(type.ofType)
    } else if (type instanceof GraphQLUnionType) {
      return (
        type
          .getTypes()
          .filter((unionType) =>
            this.hasReferenceToTypeWithEntryDirective(unionType),
          ).length > 0
      )
    } else if (type instanceof GraphQLObjectType) {
      const astNode = type.astNode
      if (
        Array.isArray(astNode['directives']) &&
        astNode['directives'].filter(
          (directive) => directive.name.value === 'Entry',
        ).length > 0
      ) {
        return true
      }
    }
    return false
  }
}

export interface ISchemaAnalyzerResult {
  entityDirectiveTypes: GraphQLObjectType[]
  objectTypes: GraphQLObjectType[]
  interfaceTypes: GraphQLInterfaceType[]
  unionTypes: GraphQLUnionType[]
  typesWithEntryReferences: {
    type: GraphQLObjectType
    fields: GraphQLField<any, any>[]
  }[]
}
