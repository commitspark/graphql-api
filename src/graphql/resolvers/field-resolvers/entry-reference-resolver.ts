import { FieldResolver } from './types.ts'
import { isNamedType } from 'graphql'
import { findById } from '../../../persistence/persistence.ts'
import { createError, ErrorCode } from '../../errors.ts'

export const resolveEntryReference: FieldResolver = async (
  fieldValue,
  args,
  context,
  info,
) => {
  void info
  if (!isNamedType(context.currentType)) {
    throw createError(
      `Expected context.currentType type to be a named type.`,
      ErrorCode.INTERNAL_ERROR,
      {
        fieldValue: fieldValue,
      },
    )
  }

  if (
    fieldValue === null ||
    typeof fieldValue !== 'object' ||
    !('id' in fieldValue) ||
    typeof fieldValue.id !== 'string'
  ) {
    throw createError(
      'Expected fieldValue.id to be a string.',
      ErrorCode.INTERNAL_ERROR,
      {
        fieldValue: fieldValue,
      },
    )
  }

  const entry = await findById(context, fieldValue.id)

  return { ...entry.data, id: entry.id }
}
