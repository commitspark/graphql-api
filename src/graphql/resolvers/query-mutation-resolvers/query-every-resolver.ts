import { EntryData } from '@commitspark/git-adapter'
import { findByType } from '../../../persistence/persistence.ts'
import { QueryMutationResolver } from '../types.ts'
import { assertValidEntry } from '../../../validation/repository-validator.ts'

export const queryEveryResolver: QueryMutationResolver<
  Promise<EntryData>[]
> = async (_source, _args, context, info) => {
  const entries = await findByType(context, context.type.name)

  // entries are returned as separate promises, so that an entry that cannot be read only nulls its own element
  return entries.map(async (entry) => {
    await assertValidEntry(context, info.schema, entry)
    return { ...entry.data, id: entry.id }
  })
}
