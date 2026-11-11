import { EntryData } from '@commitspark/git-adapter'
import { findByTypeId } from '../../../persistence/persistence.ts'
import { QueryMutationResolver } from '../types.ts'
import { assertValidEntry } from '../../../validation/repository-validator.ts'

export const queryByIdResolver: QueryMutationResolver<EntryData> = async (
  _source,
  args,
  context,
  info,
) => {
  const entry = await findByTypeId(context, context.type.name, args.id)
  await assertValidEntry(context, info.schema, entry)

  return { ...entry.data, id: entry.id }
}
