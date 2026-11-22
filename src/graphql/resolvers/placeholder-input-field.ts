import { GraphQLObjectType } from 'graphql'
import { EntryData } from '@commitspark/git-adapter'
import { createError, ErrorCode } from '../errors.ts'
import { PLACEHOLDER_INPUT_FIELD_NAME } from '../schema-utils/generated-names.ts'

/**
 * Throws an error with code `BAD_USER_INPUT` if the given data of an entry gives the placeholder field of an input
 * type without fields, as the placeholder is no field of the entry type and would otherwise be written into the entry.
 * The placeholder is only generated for `@Entry` types, as all other object types keep at least one field in their
 * input type.
 */
export function assertNoPlaceholderField(
  entryType: GraphQLObjectType,
  data: EntryData,
): void {
  if (
    typeof data === 'object' &&
    data !== null &&
    Object.hasOwn(data, PLACEHOLDER_INPUT_FIELD_NAME) &&
    entryType.getFields()[PLACEHOLDER_INPUT_FIELD_NAME] === undefined
  ) {
    throw createError(
      `Field "${PLACEHOLDER_INPUT_FIELD_NAME}" is a placeholder, as type "${entryType.name}" has no fields to give, and must not be given.`,
      ErrorCode.BAD_USER_INPUT,
      {
        argumentName: 'data',
        argumentValue: data,
      },
    )
  }
}
