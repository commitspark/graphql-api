import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLNullableType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { SchemaAnalyzerResult } from './schema-analyzer.ts'
import {
  buildsOnTypeWithEntryDirective,
  isUnionOfEntryTypes,
} from './schema-utils/entry-type-util.ts'
import {
  idInputTypeName,
  inputTypeName,
} from './schema-utils/generated-names.ts'
import {
  ENTRY_DIRECTIVE_NAME,
  hasDirective,
} from './schema-utils/directive-util.ts'

function generateFieldInputTypeString(type: GraphQLNullableType): string {
  if (isListType(type)) {
    return `[${generateFieldInputTypeString(type.ofType)}]`
  } else if (isNonNullType(type)) {
    return `${generateFieldInputTypeString(type.ofType)}!`
  } else if (isObjectType(type)) {
    if (hasDirective(type, ENTRY_DIRECTIVE_NAME)) {
      return idInputTypeName(type.name)
    } else {
      return inputTypeName(type.name)
    }
  } else if (isUnionType(type)) {
    if (buildsOnTypeWithEntryDirective(type)) {
      return idInputTypeName(type.name)
    } else {
      return inputTypeName(type.name)
    }
  } else {
    return (
      type as GraphQLScalarType | GraphQLEnumType | GraphQLInputObjectType
    ).name
  }
}

export function generateIdInputTypeStrings(
  schemaAnalyzerResult: SchemaAnalyzerResult,
): string[] {
  const typesWithIdField: (GraphQLObjectType | GraphQLUnionType)[] = [
    ...schemaAnalyzerResult.entryDirectiveTypes,
    ...schemaAnalyzerResult.unionTypes.filter((unionType) =>
      isUnionOfEntryTypes(unionType),
    ),
  ]

  return typesWithIdField.map((type): string => {
    return `input ${idInputTypeName(type.name)} {\n` + '  id: ID!\n' + '}\n'
  })
}

export function generateObjectInputTypeStrings(
  objectTypes: GraphQLObjectType[],
): string[] {
  return objectTypes.map((objectType): string => {
    const name = objectType.name
    const isEntryType = hasDirective(objectType, ENTRY_DIRECTIVE_NAME)
    let inputType = `input ${inputTypeName(name)} {\n`
    let inputTypeFieldStrings = ''
    for (const fieldsKey in objectType.getFields()) {
      const field = objectType.getFields()[fieldsKey]
      // the ID of an entry is passed as mutation argument instead of as part of the entry data
      if (isEntryType && field.name === 'id') {
        continue
      }
      const inputTypeString = generateFieldInputTypeString(field.type)
      inputTypeFieldStrings += `  ${field.name}: ${inputTypeString}\n`
    }

    if (inputTypeFieldStrings.length > 0) {
      inputType += `${inputTypeFieldStrings}`
    } else {
      // generate a dummy field as empty input types are not permitted
      inputType += '  _: Boolean\n'
    }
    inputType += '}\n'

    return inputType
  })
}

export function generateUnionInputTypeStrings(
  unionTypes: GraphQLUnionType[],
): string[] {
  return unionTypes.map((unionType): string => {
    if (buildsOnTypeWithEntryDirective(unionType)) {
      return ''
    }

    // `@oneOf` is a directive specified by GraphQL and built into graphql-js since 16.9
    let unionInputType = `input ${inputTypeName(unionType.name)} @oneOf {\n`
    for (const innerType of unionType.getTypes()) {
      unionInputType += `  ${innerType.name}: ${inputTypeName(innerType.name)}\n`
    }
    unionInputType += '}\n'
    return unionInputType
  })
}
