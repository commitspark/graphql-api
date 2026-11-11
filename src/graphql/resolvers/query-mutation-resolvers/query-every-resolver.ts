import { EntryData } from '@commitspark/git-adapter'
import { findByType } from '../../../persistence/persistence.ts'
import { QueryMutationResolver } from '../types.ts'
import { assertValidEntry } from '../../../validation/repository-validator.ts'

export const queryEveryResolver: QueryMutationResolver<EntryData[]> = async (
  _source,
  _args,
  context,
  info,
) => {
  const entries = await findByType(context, context.type.name)
  for (const entry of entries) {
    await assertValidEntry(context, info.schema, entry)
  }

  return entries.map((entry) => {
    return { ...entry.data, id: entry.id }
  })
}
