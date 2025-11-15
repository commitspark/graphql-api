import {
  GraphQLNullableType,
  GraphQLObjectType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { ApolloContext } from '../../client'
import { getTypeById } from '../../persistence/persistence'
import {
  getUnionTypeNameFromFieldValue,
  getUnionValue,
} from './union-type-util'
import { hasEntryDirective, isUnionOfEntryTypes } from './entry-type-util'
import { createError, ErrorCode } from '../errors'

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
  fieldValue: any,
): Promise<void> {
  if (isNonNullType(fieldType)) {
    await validateReference(context, fieldName, fieldType.ofType, fieldValue)
    return
  } else if (isListType(fieldType)) {
    if (!Array.isArray(fieldValue)) {
      throw createError(
        `Expected array while validation references for field "${fieldName}".`,
        ErrorCode.SCHEMA_DATA_MISMATCH,
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
    if (!('id' in fieldValue)) {
      throw createError(
        `Expected key "id" in data while validating reference for field "${fieldName}".`,
        ErrorCode.SCHEMA_DATA_MISMATCH,
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
    } catch (error) {
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
  data: any,
): Promise<string[]> {
  if (isNonNullType(type)) {
    return getReferencedEntryIds(
      rootType,
      context,
      fieldName,
      type.ofType,
      data,
    )
  } else if (isListType(type)) {
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
      await validateReference(context, '', type, data)
      return [data.id]
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
      await validateReference(context, fieldName ?? '', type, data)
      return [data.id]
    } else {
      let referencedEntryIds: string[] = []
      for (const [fieldsKey, field] of Object.entries(type.getFields())) {
        const fieldValue = data[fieldsKey] ?? undefined
        if (fieldValue !== undefined) {
          const nestedResult = await getReferencedEntryIds(
            rootType,
            context,
            fieldsKey,
            field.type,
            fieldValue,
          )
          referencedEntryIds = [...referencedEntryIds, ...nestedResult]
        }
      }
      // deduplicate
      referencedEntryIds = [...new Set(referencedEntryIds)]
      return referencedEntryIds
    }
  }

  return []
}
