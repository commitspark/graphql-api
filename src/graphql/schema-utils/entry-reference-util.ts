import {
  GraphQLError,
  GraphQLNullableType,
  GraphQLObjectType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { ApolloContext } from '../../client'
import { getTypeById } from '../../persistence/persistence.service'
import {
  getUnionTypeNameFromFieldValue,
  getUnionValue,
} from './union-type-util'
import { hasEntryDirective, isUnionOfEntryTypes } from './entry-type-util'

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
      throw new Error(`Expected array value in field "${fieldName}"`)
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
      throw new Error('Expected key "id"')
    }
    const referencedId = fieldValue.id
    let referencedTypeName
    try {
      referencedTypeName = await getTypeById(
        context.gitAdapter,
        context.getCurrentRef(),
        referencedId,
      )
    } catch (error) {
      throw new GraphQLError(
        `Reference with id "${referencedId}" points to non-existing entry`,
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldName: fieldName,
          },
        },
      )
    }
    if (!isPermittedReferenceType(referencedTypeName, fieldType)) {
      throw new GraphQLError(
        `Reference with id "${referencedId}" points to entry of incompatible type`,
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            fieldName: fieldName,
          },
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

    const unionTypeName = getUnionTypeNameFromFieldValue(data)
    const unionType = type
      .getTypes()
      .find((type) => type.name === unionTypeName)
    if (!unionType) {
      throw new Error(
        `Type "${unionTypeName}" found in field data is not a valid type for union type "${type.name}".`,
      )
    }
    const unionValue = getUnionValue(data)
    return getReferencedEntryIds(
      rootType,
      context,
      fieldName,
      unionType,
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
