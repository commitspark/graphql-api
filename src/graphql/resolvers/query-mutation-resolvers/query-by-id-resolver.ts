import { EntryData } from '@commitspark/git-adapter'
import { findByTypeId } from '../../../persistence/persistence.ts'
import { QueryMutationResolver } from '../types.ts'

export const queryByIdResolver: QueryMutationResolver<EntryData> = async (
  _source,
  args,
  context,
  info,
) => {
  void info
  const entry = await findByTypeId(context, context.type.name, args.id)

  return { ...entry.data, id: entry.id }
}
