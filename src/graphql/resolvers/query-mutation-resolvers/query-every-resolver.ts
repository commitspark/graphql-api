import { EntryData } from '@commitspark/git-adapter'
import { findByType } from '../../../persistence/persistence.ts'
import { QueryMutationResolver } from '../types.ts'
import { createEntrySource } from '../entry-data-source.ts'

export const queryEveryResolver: QueryMutationResolver<
  Promise<EntryData>[]
> = async (_source, _args, context, info) => {
  const entries = await findByType(context, context.type.name)

  // entries are returned as separate promises, so that an entry that cannot be read only nulls its own element
  return entries.map((entry) => createEntrySource(context, info.schema, entry))
}
