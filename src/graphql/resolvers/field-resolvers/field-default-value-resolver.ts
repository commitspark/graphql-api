import { FieldResolver } from './types.ts'
import { isListType, isNonNullType, isObjectType, isUnionType } from 'graphql'
import { buildsOnTypeWithEntryDirective } from '../../schema-utils/entry-type-util.ts'
import {
  ENTRY_DIRECTIVE_NAME,
  hasDirective,
} from '../../schema-utils/directive-util.ts'
import { resolveEntryReference } from './entry-reference-resolver.ts'
import { resolveUnionValue } from './union-value-resolver.ts'

/**
 * Resolves the value of a field that holds a list, union or object. Entries are validated before their data is
 * returned, so the data processed here matches the schema. Missing values of non-null fields are reported by the
 * validation.
 */
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
      { ...context, currentType: context.currentType.ofType },
      info,
    )
  }

  if (fieldValue === undefined || fieldValue === null) {
    return null
  }

  if (isListType(context.currentType)) {
    const itemType = context.currentType.ofType
    return Promise.all(
      (fieldValue as unknown[]).map((item) =>
        resolveFieldDefaultValue(
          item as typeof fieldValue,
          args,
          { ...context, currentType: itemType },
          info,
        ),
      ),
    )
  }

  if (isUnionType(context.currentType)) {
    if (buildsOnTypeWithEntryDirective(context.currentType)) {
      return resolveEntryReference(fieldValue, args, context, info)
    }
    return resolveUnionValue(fieldValue, args, context, info)
  }

  if (
    isObjectType(context.currentType) &&
    hasDirective(context.currentType, ENTRY_DIRECTIVE_NAME)
  ) {
    return resolveEntryReference(fieldValue, args, context, info)
  }

  return fieldValue
}
