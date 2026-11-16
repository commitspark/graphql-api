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
  getMergedObjectType,
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
 * Generates the input types of update mutations for the `@Entry` types and for the object types embedded in them as
 * single objects. All fields are optional, so that only fields to change need to be given. Embedded single objects
 * use update input types themselves, as they are merged into the stored object, while lists and unions use the input
 * types for creating an entry, as their values replace the stored value as a whole.
 */
export function generateUpdateInputTypeStrings(
  objectTypes: GraphQLObjectType[],
): string[] {
  const mergedTypeNames = new Set<string>()
  const collectMergedTypes = (type: GraphQLObjectType): void => {
    for (const field of Object.values(type.getFields())) {
      const mergedType = getMergedObjectType(field.type)
      if (mergedType !== undefined && !mergedTypeNames.has(mergedType.name)) {
        mergedTypeNames.add(mergedType.name)
        collectMergedTypes(mergedType)
      }
    }
  }
  const entryTypes = objectTypes.filter((type) =>
    hasDirective(type, ENTRY_DIRECTIVE_NAME),
  )
  entryTypes.forEach(collectMergedTypes)

  return objectTypes
    .filter(
      (type) =>
        hasDirective(type, ENTRY_DIRECTIVE_NAME) ||
        mergedTypeNames.has(type.name),
    )
    .map((objectType): string => {
      const isEntryType = hasDirective(objectType, ENTRY_DIRECTIVE_NAME)
      let fieldStrings = ''
      for (const field of Object.values(objectType.getFields())) {
        // the ID of an entry is passed as mutation argument instead of as part of the entry data
        if (isEntryType && field.name === 'id') {
          continue
        }
        const mergedType = getMergedObjectType(field.type)
        const fieldTypeString =
          mergedType !== undefined
            ? updateInputTypeName(mergedType.name)
            : generateFieldInputTypeString(
                isNonNullType(field.type) ? field.type.ofType : field.type,
              )
        fieldStrings += `  ${field.name}: ${fieldTypeString}\n`
      }
      if (fieldStrings.length === 0) {
        // generate a dummy field as empty input types are not permitted
        fieldStrings = '  _: Boolean\n'
      }

      const description = isEntryType
        ? `Data to update an entry of type "${objectType.name}" with.`
        : `Data to update an object of type "${objectType.name}" with.`
      return (
        '"""\n' +
        `${description} Fields that are not given keep their stored value, and\n` +
        '`null` clears a field. Objects given for fields of an object type are merged into the stored object in the\n' +
        'same way, while lists and unions given replace the stored value as a whole.\n' +
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
