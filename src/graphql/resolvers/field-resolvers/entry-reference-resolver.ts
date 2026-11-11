import { FieldResolver } from './types.ts'
import { EntryData } from '@commitspark/git-adapter'
import { findById } from '../../../persistence/persistence.ts'
import { assertValidEntry } from '../../../validation/repository-validator.ts'

export const resolveEntryReference: FieldResolver = async (
  fieldValue,
  _args,
  context,
  info,
) => {
  // the shape of references is ensured by validating the referencing entry before its data is returned
  const reference = fieldValue as EntryData & { id: string }
  const entry = await findById(context, reference.id)
  await assertValidEntry(context, info.schema, entry)

  return { ...entry.data, id: entry.id }
}
