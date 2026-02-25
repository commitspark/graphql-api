import { EntryData } from '@commitspark/git-adapter'
import { findByType } from '../../../persistence/persistence.ts'
import { QueryMutationResolver } from '../types.ts'

export const queryEveryResolver: QueryMutationResolver<EntryData[]> = async (
  _source,
  _args,
  context,
  info,
) => {
  void info
  const entries = await findByType(context, context.type.name)

  return entries.map((entry) => {
    return { ...entry.data, id: entry.id }
  })
}
