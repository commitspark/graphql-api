import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLType,
  GraphQLObjectType,
  GraphQLOutputType,
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
  getMergedObjectType,
  isUnionOfEntryTypes,
} from './schema-utils/entry-type-util.ts'
import {
  idInputTypeName,
  inputTypeName,
  PLACEHOLDER_INPUT_FIELD_NAME,
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

/**
 * Generates the field definitions of an input type for the given object type, with the input type of each field given
 * by `fieldInputTypeString`. The ID of an entry is left out, as it is passed as mutation argument instead of as part of
 * the entry data. If no fields remain, a placeholder field is generated, as empty input types are not permitted.
 */
function generateInputFieldStrings(
  objectType: GraphQLObjectType,
  fieldInputTypeString: (fieldType: GraphQLOutputType) => string,
): string {
  const isEntryType = hasDirective(objectType, ENTRY_DIRECTIVE_NAME)
  let fieldStrings = ''
  for (const field of Object.values(objectType.getFields())) {
    if (isEntryType && field.name === 'id') {
      continue
    }
    fieldStrings += `  ${field.name}: ${fieldInputTypeString(field.type)}\n`
  }
  if (fieldStrings.length === 0) {
    return `  ${PLACEHOLDER_INPUT_FIELD_NAME}: Boolean\n`
  }
  return fieldStrings
}

export function generateObjectInputTypeStrings(
  objectTypes: GraphQLObjectType[],
): string[] {
  return objectTypes.map(
    (objectType): string =>
      `input ${inputTypeName(objectType.name)} {\n` +
      generateInputFieldStrings(objectType, generateFieldInputTypeString) +
      '}\n',
  )
}

/**
 * Generates the input types of update mutations for all object types, independent of whether a type is used as single
 * embedded object, so that the generated types do not change when a type is used differently. All fields are
 * optional, so that only fields to change need to be given. Embedded single objects use update input types themselves,
 * as they are merged into the stored object, while lists, unions and references use the input types for creating an
 * entry, as their values replace the stored value as a whole.
 */
export function generateUpdateInputTypeStrings(
  objectTypes: GraphQLObjectType[],
): string[] {
  return objectTypes.map((objectType): string => {
    const isEntryType = hasDirective(objectType, ENTRY_DIRECTIVE_NAME)
    const fieldStrings = generateInputFieldStrings(objectType, (fieldType) => {
      const mergedType = getMergedObjectType(fieldType)
      if (mergedType !== undefined) {
        return updateInputTypeName(mergedType.name)
      }
      return generateFieldInputTypeString(
        isNonNullType(fieldType) ? fieldType.ofType : fieldType,
      )
    })

    const description = isEntryType
      ? `Data to update an entry of type "${objectType.name}" with.`
      : `Data to update an object of type "${objectType.name}" with.`
    return (
      '"""\n' +
      `${description} Fields that are not given keep their stored value, and\n` +
      '`null` clears a nullable field. Objects given for fields of an object type are merged into the stored object\n' +
      'in the same way, while lists, unions and references given replace the stored value as a whole.\n' +
      '"""\n' +
      `input ${updateInputTypeName(objectType.name)} {\n${fieldStrings}}\n`
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
