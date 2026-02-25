import {
  GraphQLNullableType,
  GraphQLObjectType,
  GraphQLUnionType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
} from 'graphql'
import { ApolloContext } from '../../client.ts'
import { getTypeById } from '../../persistence/persistence.ts'
import {
  getUnionTypeNameFromFieldValue,
  getUnionValue,
} from './union-type-util.ts'
import { hasEntryDirective, isUnionOfEntryTypes } from './entry-type-util.ts'
import { createError, ErrorCode } from '../errors.ts'
import { EntryData } from '@commitspark/git-adapter'
import { isRecord } from '../util.ts'

function isPermittedReferenceType(
  referencedTypeName: string,
  fieldType: GraphQLNullableType,
): boolean {
  if (isNonNullType(fieldType)) {
    return isPermittedReferenceType(referencedTypeName, fieldType.ofType)
  } else if (isListType(fieldType)) {
    return isPermittedReferenceType(referencedTypeName, fieldType.ofType)
  } else if (isUnionType(fieldType)) {
    return fieldType
      .getTypes()
      .map((concreteType) => concreteType.name)
      .includes(referencedTypeName)
  } else if (isObjectType(fieldType)) {
    return fieldType.name === referencedTypeName
  }
  return false
}

async function validateReference(
  context: ApolloContext,
  fieldName: string,
  fieldType: GraphQLNullableType,
  fieldValue: EntryData,
): Promise<void> {
  if (isNonNullType(fieldType)) {
    await validateReference(context, fieldName, fieldType.ofType, fieldValue)
    return
  } else if (isListType(fieldType)) {
    if (!Array.isArray(fieldValue)) {
      throw createError(
        `Expected array while validation references for field "${fieldName}".`,
        ErrorCode.BAD_REPOSITORY_DATA,
        {
          fieldName: fieldName,
          fieldValue: fieldValue,
        },
      )
    }
    for (const fieldListElement of fieldValue) {
      await validateReference(
        context,
        fieldName,
        fieldType.ofType,
        fieldListElement,
      )
    }
    return
  } else if (isUnionType(fieldType) || isObjectType(fieldType)) {
    if (
      fieldValue === null ||
      !('id' in fieldValue) ||
      typeof fieldValue.id !== 'string'
    ) {
      throw createError(
        `Expected key "id" with value of type string in data while validating reference for field "${fieldName}".`,
        ErrorCode.BAD_REPOSITORY_DATA,
        {
          fieldName: fieldName,
          fieldValue: fieldValue,
        },
      )
    }

    const referencedId = fieldValue.id
    let referencedTypeName
    try {
      referencedTypeName = await getTypeById(context, referencedId)
    } catch {
      throw createError(
        `Failed to resolve entry reference "${referencedId}".`,
        ErrorCode.BAD_USER_INPUT,
        {
          fieldName: fieldName,
          fieldValue: referencedId,
        },
      )
    }
    if (!isPermittedReferenceType(referencedTypeName, fieldType)) {
      throw createError(
        `Reference with ID "${referencedId}" points to entry of incompatible type "${referencedTypeName}".`,
        ErrorCode.BAD_USER_INPUT,
        {
          fieldName: fieldName,
          fieldValue: referencedId,
        },
      )
    }
  }
}

export async function getReferencedEntryIds(
  rootType: GraphQLObjectType,
  context: ApolloContext,
  fieldName: string | null,
  type: GraphQLNullableType,
  data: EntryData | EntryData[],
): Promise<string[]> {
  if (data === null || isScalarType(type)) {
    return []
  }

  if (isNonNullType(type)) {
    return getReferencedEntryIds(
      rootType,
      context,
      fieldName,
      type.ofType,
      data,
    )
  } else if (isListType(type)) {
    if (!Array.isArray(data)) {
      throw createError(
        `Expected array as data for field "${fieldName}". `,
        ErrorCode.BAD_REPOSITORY_DATA,
        {
          fieldName: fieldName ? fieldName : undefined,
          fieldValue: data,
        },
      )
    }

    let referencedEntryIds: string[] = []
    for (const element of data) {
      referencedEntryIds = [
        ...referencedEntryIds,
        ...(await getReferencedEntryIds(
          rootType,
          context,
          fieldName,
          type.ofType,
          element,
        )),
      ]
    }
    // deduplicate
    referencedEntryIds = [...new Set(referencedEntryIds)]
    return referencedEntryIds
  } else if (isUnionType(type)) {
    if (isUnionOfEntryTypes(type)) {
      const referenceId = await getValidatedReferenceId(
        context,
        fieldName,
        type,
        data,
      )
      return [referenceId]
    }

    const requestedUnionTypeName = getUnionTypeNameFromFieldValue(data)
    const concreteFieldUnionType = type
      .getTypes()
      .find(
        (concreteFieldType) =>
          concreteFieldType.name === requestedUnionTypeName,
      )
    if (!concreteFieldUnionType) {
      throw createError(
        `Type "${requestedUnionTypeName}" found in field data is not a valid type for ` +
          `union type "${type.name}".`,
        ErrorCode.BAD_REPOSITORY_DATA,
        {
          typeName: type.name,
          fieldName: fieldName ? fieldName : undefined,
          fieldValue: data,
        },
      )
    }
    const unionValue = getUnionValue(data)
    return getReferencedEntryIds(
      rootType,
      context,
      fieldName,
      concreteFieldUnionType,
      unionValue,
    )
  } else if (isObjectType(type)) {
    if (type.name !== rootType.name && hasEntryDirective(type)) {
      const referenceId = await getValidatedReferenceId(
        context,
        fieldName,
        type,
        data,
      )
      return [referenceId]
    } else {
      let referencedEntryIds: string[] = []
      for (const [fieldsKey, field] of Object.entries(type.getFields())) {
        if (Array.isArray(data)) {
          throw createError(
            `Expected object as data for type "${type.name}".`,
            ErrorCode.BAD_REPOSITORY_DATA,
            {
              typeName: type.name,
              fieldName: field.name ? field.name : undefined,
            },
          )
        }

        const fieldValue = data[fieldsKey]
        if (
          fieldValue === undefined ||
          fieldValue === null ||
          isScalarType(field.type)
        ) {
          continue
        }

        if (!(Array.isArray(fieldValue) || isRecord(fieldValue))) {
          throw createError(
            `Expected object or array as data for field "${field.name}" of type "${type.name}".`,
            ErrorCode.BAD_REPOSITORY_DATA,
            {
              typeName: type.name,
              fieldName: field.name ? field.name : undefined,
              fieldValue: fieldValue,
            },
          )
        }
        // recursively get referenced IDs in nested data
        const nestedResult = await getReferencedEntryIds(
          rootType,
          context,
          fieldsKey,
          field.type,
          fieldValue,
        )
        referencedEntryIds = [...referencedEntryIds, ...nestedResult]
      }
      // deduplicate
      referencedEntryIds = [...new Set(referencedEntryIds)]
      return referencedEntryIds
    }
  }

  return []
}

async function getValidatedReferenceId(
  context: ApolloContext,
  fieldName: string | null,
  type: GraphQLUnionType | GraphQLObjectType,
  data: EntryData | EntryData[],
): Promise<string> {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw createError(
      `Expected object as data for field "${fieldName}" of type "${type.name}".`,
      ErrorCode.BAD_REPOSITORY_DATA,
      {
        typeName: type.name,
        fieldName: fieldName ? fieldName : undefined,
        fieldValue: data,
      },
    )
  }
  await validateReference(context, fieldName ? fieldName : '', type, data)

  let referencedId = null
  if (typeof (referencedId = data.id) !== 'string') {
    throw createError(
      `Expected a key "id" with value of type string in data of field "${fieldName}" of type "${type.name}"` +
        ` after this reference was just verified to be valid.`,
      ErrorCode.INTERNAL_ERROR,
      {
        typeName: type.name,
        fieldName: fieldName ? fieldName : undefined,
        fieldValue: data,
      },
    )
  }

  return referencedId
}
