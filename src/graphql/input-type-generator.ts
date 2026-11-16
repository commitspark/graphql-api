import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLType,
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
  updateInputTypeName,
} from './schema-utils/generated-names.ts'
import {
  ENTRY_DIRECTIVE_NAME,
  hasDirective,
} from './schema-utils/directive-util.ts'

function generateFieldInputTypeString(type: GraphQLType): string {
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

/**
 * Generates the input types of update mutations, which contain the fields of the `@Entry` type without `id` and with
 * all fields optional, so that only fields to change need to be given. The values of the fields use the same types as
 * the input type for creating an entry, as values given are written as a whole.
 */
export function generateUpdateInputTypeStrings(
  entryDirectiveTypes: GraphQLObjectType[],
): string[] {
  return entryDirectiveTypes.map((entryType): string => {
    let fieldStrings = ''
    for (const field of Object.values(entryType.getFields())) {
      if (field.name === 'id') {
        continue
      }
      const fieldType = isNonNullType(field.type)
        ? field.type.ofType
        : field.type
      fieldStrings += `  ${field.name}: ${generateFieldInputTypeString(fieldType)}\n`
    }
    if (fieldStrings.length === 0) {
      // generate a dummy field as empty input types are not permitted
      fieldStrings = '  _: Boolean\n'
    }

    return (
      '"""\n' +
      `Data to update an entry of type "${entryType.name}" with. Fields that are not given keep their stored value,\n` +
      'and `null` clears a field. A value given for a field replaces the stored value as a whole, including objects\n' +
      'and lists.\n' +
      '"""\n' +
      `input ${updateInputTypeName(entryType.name)} {\n${fieldStrings}}\n`
    )
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
