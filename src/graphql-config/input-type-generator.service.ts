import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLNullableType,
  GraphQLUnionType,
} from 'graphql/type/definition'
import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
} from 'graphql'
import { ISchemaAnalyzerResult } from './schema-analyzer.service'

export class InputTypeGeneratorService {
  public generateFieldInputTypeString(
    type: GraphQLNullableType,
    entityDirectiveTypes: GraphQLObjectType[],
  ): string {
    if (type instanceof GraphQLList) {
      return `[${this.generateFieldInputTypeString(
        type.ofType,
        entityDirectiveTypes,
      )}]`
    } else if (type instanceof GraphQLNonNull) {
      return `${this.generateFieldInputTypeString(
        type.ofType,
        entityDirectiveTypes,
      )}!`
    } else if (type instanceof GraphQLObjectType) {
      if (
        entityDirectiveTypes.filter(
          (entityType) => entityType.name === type.name,
        ).length > 0
      ) {
        return `${type.name}IdInput`
      } else {
        return `${type.name}Input`
      }
    } else if (
      type instanceof GraphQLInterfaceType ||
      type instanceof GraphQLUnionType
    ) {
      return `${type.name}IdInput`
    } else {
      return (
        type as GraphQLScalarType | GraphQLEnumType | GraphQLInputObjectType
      ).name
    }
  }

  public generateIdInputTypeStrings(
    schemaAnalyzerResult: ISchemaAnalyzerResult,
  ): string[] {
    let typesWithIdField: (
      | GraphQLObjectType
      | GraphQLInterfaceType
      | GraphQLUnionType
    )[] = []
    typesWithIdField = typesWithIdField.concat(
      schemaAnalyzerResult.entityDirectiveTypes,
    )
    typesWithIdField = typesWithIdField.concat(
      schemaAnalyzerResult.interfaceTypes,
    )
    typesWithIdField = typesWithIdField.concat(schemaAnalyzerResult.unionTypes)

    return typesWithIdField.map((type): string => {
      return `input ${type.name}IdInput {\n` + '  id:ID!\n' + '}\n'
    })
  }

  public generateObjectInputTypeStrings(
    schemaAnalyzerResult: ISchemaAnalyzerResult,
  ): string[] {
    return schemaAnalyzerResult.objectTypes.map((objectType): string => {
      const name = objectType.name
      const inputTypeName = `${name}Input`
      let inputType = `input ${inputTypeName} {\n`
      for (const fieldsKey in objectType.getFields()) {
        const field = objectType.getFields()[fieldsKey]
        if (field.name === 'id') {
          // TODO check by type name `ID` (incl. non-null) instead of field name
          continue
        }
        const inputTypeString = this.generateFieldInputTypeString(
          field.type,
          schemaAnalyzerResult.entityDirectiveTypes,
        )
        inputType += `  ${field.name}: ${inputTypeString}\n`
      }
      inputType += '}\n'
      return inputType
    })
  }
}
