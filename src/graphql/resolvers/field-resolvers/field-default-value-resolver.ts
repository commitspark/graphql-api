import { FieldResolver, FieldResolverContext, ResolvedEntryData } from './types'
import { EntryData } from '@commitspark/git-adapter'
import {
  GraphQLNonNull,
  GraphQLResolveInfo,
  GraphQLUnionType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import {
  buildsOnTypeWithEntryDirective,
  hasEntryDirective,
} from '../../schema-utils/entry-type-util'
import { resolveEntryReference } from './entry-reference-resolver'
import { resolveUnionValue } from './union-value-resolver'

export const resolveFieldDefaultValue: FieldResolver<any> = async (
  fieldValue: any,
  args: any,
  context: FieldResolverContext,
  info: GraphQLResolveInfo,
): Promise<ResolvedEntryData<EntryData | EntryData[] | null>> => {
  if (isNonNullType(context.currentType)) {
    return resolveFieldDefaultValue(
      fieldValue,
      args,
      {
        gitAdapter: context.gitAdapter,
        getCurrentRef: context.getCurrentRef,
        currentType: context.currentType.ofType,
        hasNonNullParent: true,
      },
      info,
    )
  } else if (isListType(context.currentType)) {
    if (fieldValue === undefined || fieldValue === null) {
      if (context.hasNonNullParent) {
        return new Promise((resolve) => resolve([]))
      } else {
        return new Promise((resolve) => resolve(null))
      }
    }

    if (!Array.isArray(fieldValue)) {
      throw new Error(
        `Expected array while resolving value for field "${info.fieldName}".`,
      )
    }

    const resultPromises = []
    for (const item of fieldValue) {
      const resultPromise = resolveFieldDefaultValue(
        item,
        args,
        {
          gitAdapter: context.gitAdapter,
          getCurrentRef: context.getCurrentRef,
          currentType: context.currentType.ofType,
          hasNonNullParent: context.hasNonNullParent,
        },
        info,
      )
      resultPromises.push(resultPromise)
    }
    return Promise.all(resultPromises)
  } else if (isUnionType(context.currentType)) {
    if (fieldValue === undefined || fieldValue === null) {
      if (context.hasNonNullParent) {
        throw new Error(
          `Cannot generate a default value for NonNull field "${
            info.parentType.name
          }.${info.fieldName}" because it is a union field of type "${
            (info.returnType as GraphQLNonNull<GraphQLUnionType>).ofType.name
          }".`,
        )
      } else {
        return new Promise((resolve) => resolve(null))
      }
    }

    if (buildsOnTypeWithEntryDirective(context.currentType)) {
      return resolveEntryReference(fieldValue, args, context, info)
    }

    return resolveUnionValue(fieldValue, args, context, info)
  } else if (isObjectType(context.currentType)) {
    if (fieldValue === undefined || fieldValue === null) {
      if (context.hasNonNullParent) {
        throw new Error(
          `Cannot generate a default value for NonNull field "${info.fieldName}" of type "${info.parentType.name}".`,
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
