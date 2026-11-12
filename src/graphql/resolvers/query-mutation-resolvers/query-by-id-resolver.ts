import { EntryData } from '@commitspark/git-adapter'
import { findByTypeId } from '../../../persistence/persistence.ts'
import { QueryMutationResolver } from '../types.ts'
import { createEntrySource } from '../entry-data-source.ts'

export const queryByIdResolver: QueryMutationResolver<EntryData> = async (
  _source,
  args,
  context,
  info,
) => {
  const entry = await findByTypeId(context, context.type.name, args.id)
  return createEntrySource(context, info.schema, entry)
}
