import { FieldResolver } from './types.ts'
import {
  GraphQLNonNull,
  GraphQLUnionType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import {
  buildsOnTypeWithEntryDirective,
  hasEntryDirective,
} from '../../schema-utils/entry-type-util.ts'
import { resolveEntryReference } from './entry-reference-resolver.ts'
import { resolveUnionValue } from './union-value-resolver.ts'
import { createError, ErrorCode } from '../../errors.ts'

export const resolveFieldDefaultValue: FieldResolver = async (
  fieldValue,
  args,
  context,
  info,
) => {
  if (isNonNullType(context.currentType)) {
    return resolveFieldDefaultValue(
      fieldValue,
      args,
      {
        ...context,
        currentType: context.currentType.ofType,
        hasNonNullParent: true,
      },
      info,
    )
  }

  if (isListType(context.currentType)) {
    if (fieldValue === undefined || fieldValue === null) {
      if (context.hasNonNullParent) {
        return new Promise((resolve) => resolve([]))
      } else {
        return new Promise((resolve) => resolve(null))
      }
    }

    if (!Array.isArray(fieldValue)) {
      throw createError(
        `Expected array while resolving value for field "${info.fieldName}".`,
        ErrorCode.BAD_REPOSITORY_DATA,
        {
          fieldName: info.fieldName,
          fieldValue: fieldValue,
        },
      )
    }

    const resultPromises = []
    for (const item of fieldValue) {
      const resultPromise = resolveFieldDefaultValue(
        item,
        args,
        {
          ...context,
          currentType: context.currentType.ofType,
          hasNonNullParent: context.hasNonNullParent,
        },
        info,
      )
      resultPromises.push(resultPromise)
    }
    return Promise.all(resultPromises)
  }

  if (isUnionType(context.currentType)) {
    if (fieldValue === undefined || fieldValue === null) {
      if (context.hasNonNullParent) {
        throw createError(
          `Cannot generate a default value for NonNull field "${
            info.parentType.name
          }.${info.fieldName}" because it is a union field of type "${
            (info.returnType as GraphQLNonNull<GraphQLUnionType>).ofType.name
          }". Set a value in your repository data or remove the NonNull declaration in your schema.`,
          ErrorCode.BAD_REPOSITORY_DATA,
          {
            typeName: info.parentType.name,
            fieldName: info.fieldName,
          },
        )
      } else {
        return new Promise((resolve) => resolve(null))
      }
    }

    if (buildsOnTypeWithEntryDirective(context.currentType)) {
      return resolveEntryReference(fieldValue, args, context, info)
    }

    return resolveUnionValue(fieldValue, args, context, info)
  }

  if (isObjectType(context.currentType)) {
    if (fieldValue === undefined || fieldValue === null) {
      if (context.hasNonNullParent) {
        throw createError(
          `Cannot generate a default value for NonNull field "${info.fieldName}" of type ` +
            `"${info.parentType.name}". Set a value in your repository data or remove the NonNull ` +
            `declaration in your schema.`,
          ErrorCode.BAD_REPOSITORY_DATA,
          {
            typeName: info.parentType.name,
            fieldName: info.fieldName,
          },
        )
      } else {
        return new Promise((resolve) => resolve(null))
      }
    }

    if (hasEntryDirective(context.currentType)) {
      return resolveEntryReference(fieldValue, args, context, info)
    }

    return fieldValue
  }

  return fieldValue
}
