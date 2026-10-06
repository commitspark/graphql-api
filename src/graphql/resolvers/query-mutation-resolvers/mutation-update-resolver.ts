import { findByTypeId } from '../../../persistence/persistence.ts'
import { validateEntryReferences } from '../../schema-utils/entry-reference-util.ts'
import { isObjectType } from 'graphql'
import { EntryData } from '@commitspark/git-adapter'
import { QueryMutationResolver } from '../types.ts'
import { createError, ErrorCode } from '../../errors.ts'

function mergeData(
  existingEntryData: EntryData,
  updateData: EntryData,
): EntryData {
  return {
    ...existingEntryData,
    ...updateData,
  }
}

export const mutationUpdateResolver: QueryMutationResolver<EntryData> = async (
  source,
  args,
  context,
  info,
) => {
  void info
  if (!isObjectType(context.type)) {
    throw createError(
      `Type "${context.type.name}" cannot be mutated as is not an ObjectType.`,
      ErrorCode.INTERNAL_ERROR,
      {},
    )
  }

  const existingEntry = await findByTypeId(context, context.type.name, args.id)

  const mergedData = mergeData(existingEntry.data ?? null, args.data ?? null)
  await validateEntryReferences(context.type, context, mergedData)

  const commit = await context.gitAdapter.createCommit({
    ref: context.branch,
    parentSha: context.getCurrentHash(),
    entries: [
      {
        id: existingEntry.id,
        // only the type is written, which removes metadata no longer in use from existing entries
        metadata: { type: existingEntry.metadata.type },
        data: mergedData,
        deletion: false,
      },
    ],
    message: args.commitMessage,
  })
  context.setCurrentHash(commit.commitHash)

  const updatedEntry = await findByTypeId(context, context.type.name, args.id)
  return { ...updatedEntry.data, id: updatedEntry.id }
}
