import { validateEntryId } from '@commitspark/git-adapter'
import { createError, ErrorCode } from '../errors.ts'

/**
 * Throws an error with code `BAD_USER_INPUT` if the given ID is not valid for a new entry. In addition to the rules of
 * `validateEntryId()`, which also apply when reading existing entries, a new ID must be in composed Unicode form (NFC),
 * so that an ID always has a single spelling, and no `/`-separated segment may end with `.` or a space.
 */
export function assertValidNewEntryId(id: string): void {
  const details = { argumentName: 'id', argumentValue: id }
  try {
    validateEntryId(id)
  } catch (err) {
    throw createError(
      err instanceof Error ? err.message : String(err),
      ErrorCode.BAD_USER_INPUT,
      details,
    )
  }
  if (id !== id.normalize('NFC')) {
    throw createError(
      `Entry ID "${id}" must be in composed Unicode form (NFC).`,
      ErrorCode.BAD_USER_INPUT,
      details,
    )
  }
  if (id.split('/').some((segment) => /[. ]$/.test(segment))) {
    throw createError(
      `Entry ID "${id}" must not contain segments ending with "." or a space.`,
      ErrorCode.BAD_USER_INPUT,
      details,
    )
  }
}
