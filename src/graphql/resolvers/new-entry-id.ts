import { validateEntryId } from '@commitspark/git-adapter'
import { createError, ErrorCode, ErrorMetadata } from '../errors.ts'

/**
 * Throws an error with code `BAD_USER_INPUT` if the given ID is not valid for a new entry. In addition to the rules of
 * `validateEntryId()`, which also apply when reading existing entries, a new ID must be in composed Unicode form (NFC),
 * so that an ID always has a single spelling, and no folder name, i.e. no segment before the last `/`, may end with `.`
 * or a space, as Windows removes these characters from folder names. The file name may end with them, as it is followed
 * by the file extension.
 */
export function assertValidNewEntryId(
  id: string,
  details: ErrorMetadata = { argumentName: 'id', argumentValue: id },
): void {
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
  const folderNames = id.split('/').slice(0, -1)
  if (folderNames.some((folderName) => /[. ]$/.test(folderName))) {
    throw createError(
      `Entry ID "${id}" must not contain folder names ending with "." or a space.`,
      ErrorCode.BAD_USER_INPUT,
      details,
    )
  }
}
