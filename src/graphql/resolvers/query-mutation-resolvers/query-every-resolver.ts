import { EntryData } from '@commitspark/git-adapter'
import { findByType } from '../../../persistence/persistence.ts'
import { QueryMutationResolver } from '../types.ts'
import { createEntrySource } from '../entry-data-source.ts'
import { createError, ErrorCode } from '../../errors.ts'

function assertNotNegative(argumentName: string, value: number): void {
  if (value < 0) {
    throw createError(
      `Argument "${argumentName}" must not be negative.`,
      ErrorCode.BAD_USER_INPUT,
      { argumentName, argumentValue: value },
    )
  }
}

/**
 * Returns the entries of a type ordered by ID, optionally a page of them. As a commit never changes, pages requested
 * with the same commit hash are consistent with each other, so that offsets suffice instead of cursors.
 */
export const queryEveryResolver: QueryMutationResolver<
  Promise<EntryData>[]
> = async (_source, args, context, info) => {
  const offset = args.offset ?? 0
  const first = args.first ?? undefined
  assertNotNegative('offset', offset)
  if (first !== undefined) {
    assertNotNegative('first', first)
  }

  const entries = await findByType(context, context.type.name)
  const page = entries.slice(
    offset,
    first !== undefined ? offset + first : undefined,
  )

  // entries are returned as separate promises, so that an entry that cannot be read only nulls its own element
  return page.map((entry) => createEntrySource(context, info.schema, entry))
}
