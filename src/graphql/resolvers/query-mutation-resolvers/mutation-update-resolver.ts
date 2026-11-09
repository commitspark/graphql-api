import {
  assertExpectedVersion,
  findByTypeId,
} from '../../../persistence/persistence.ts'
import { validateEntryReferences } from '../../schema-utils/entry-reference-util.ts'
import { isObjectType } from 'graphql'
import { EntryData } from '@commitspark/git-adapter'
import { QueryMutationResolver } from '../types.ts'
import { createError, ErrorCode } from '../../errors.ts'
import { getCommitMessage } from '../commit-message.ts'
import { commitWithRetry } from '../../../persistence/commit-with-retry.ts'

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
  // narrowed type, as narrowing does not apply within the callback below
  const entryType = context.type

  await commitWithRetry(context, async () => {
    const existingEntry = await findByTypeId(
      context,
      context.type.name,
      args.id,
    )
    await assertExpectedVersion(context, args.id, args.expectedVersion)

    const mergedData = mergeData(existingEntry.data ?? null, args.data ?? null)
    await validateEntryReferences(entryType, context, mergedData)

    return {
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
      message: getCommitMessage(
        args.commitMessage,
        'Update',
        context.type.name,
        args.id,
      ),
    }
  })

  const updatedEntry = await findByTypeId(context, context.type.name, args.id)
  return { ...updatedEntry.data, id: updatedEntry.id }
}
