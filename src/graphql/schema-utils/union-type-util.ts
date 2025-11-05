import { EntryData } from '@commitspark/git-adapter'
import { createError, ErrorCode } from '../errors'

export function getUnionTypeNameFromFieldValue(fieldValue: unknown): string {
  if (typeof fieldValue !== 'object' || fieldValue === null) {
    throw createError(
      `Expected object value in order to determine union type name.`,
      ErrorCode.BAD_REPOSITORY_DATA,
      {
        fieldValue: fieldValue,
      },
    )
  }

  // Based on our @oneOf directive, we expect only one field whose name
  // corresponds to the concrete type's name.
  return Object.keys(fieldValue)[0]
}

export function getUnionValue(fieldValue: unknown): EntryData {
  if (typeof fieldValue !== 'object' || fieldValue === null) {
    throw createError(
      `Expected object value in order to determine union value.`,
      ErrorCode.BAD_REPOSITORY_DATA,
      {
        fieldValue: fieldValue,
      },
    )
  }

  const firstKey = Object.keys(fieldValue)[0]
  return (fieldValue as Record<string, EntryData>)[firstKey]
}
