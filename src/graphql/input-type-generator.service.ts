import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLNullableType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { ISchemaAnalyzerResult } from './schema-analyzer.service'
import { EntryReferenceUtil } from './schema-utils/entry-reference-util'

export class InputTypeGeneratorService {
  constructor(private readonly entryReferenceUtil: EntryReferenceUtil) {}

  public generateFieldInputTypeString(type: GraphQLNullableType): string {
    if (isListType(type)) {
      return `[${this.generateFieldInputTypeString(type.ofType)}]`
    } else if (isNonNullType(type)) {
      return `${this.generateFieldInputTypeString(type.ofType)}!`
    } else if (isObjectType(type)) {
      if (this.entryReferenceUtil.hasEntryDirective(type)) {
        return `${type.name}IdInput`
      } else {
        return `${type.name}Input`
      }
    } else if (isInterfaceType(type)) {
      // TODO
      return ''
    } else if (isUnionType(type)) {
      if (this.entryReferenceUtil.buildsOnTypeWithEntryDirective(type)) {
        return `${type.name}IdInput`
      } else {
        return `${type.name}Input`
      }
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
      schemaAnalyzerResult.entryDirectiveTypes,
    )
    typesWithIdField = typesWithIdField.concat(
      schemaAnalyzerResult.interfaceTypes,
    )
    typesWithIdField = typesWithIdField.concat(schemaAnalyzerResult.unionTypes)

    return typesWithIdField.map((type): string => {
      return `input ${type.name}IdInput {\n` + '  id: ID!\n' + '}\n'
    })
  }

  public generateObjectInputTypeStrings(
    objectTypes: GraphQLObjectType[],
  ): string[] {
    return objectTypes.map((objectType): string => {
      const name = objectType.name
      const inputTypeName = `${name}Input`
      let inputType = `input ${inputTypeName} {\n`
      for (const fieldsKey in objectType.getFields()) {
        const field = objectType.getFields()[fieldsKey]
        if (field.name === 'id') {
          // TODO check by type name `ID` (incl. non-null) instead of field name
          continue
        }
        const inputTypeString = this.generateFieldInputTypeString(field.type)
        inputType += `  ${field.name}: ${inputTypeString}\n`
      }
      inputType += '}\n'
      return inputType
    })
  }

  public generateUnionInputTypeStrings(
    unionTypes: GraphQLUnionType[],
  ): string[] {
    const typeStrings = unionTypes.map((unionType): string => {
      if (this.entryReferenceUtil.buildsOnTypeWithEntryDirective(unionType)) {
        return ''
      }

      // see https://github.com/graphql/graphql-spec/pull/825
      let unionInputType = `input ${unionType.name}Input @oneOf {\n`
      for (const innerType of unionType.getTypes()) {
        const fieldName =
          innerType.name.toLowerCase().at(0) + innerType.name.substring(1)
        unionInputType += `  ${fieldName}: ${innerType.name}Input\n`
      }
      unionInputType += '}\n'
      return unionInputType
    })

    if (typeStrings.join('').length > 0) {
      typeStrings.push('directive @oneOf on INPUT_OBJECT\n')
    }

    return typeStrings
  }
}
