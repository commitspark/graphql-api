import { findByTypeId } from '../../../persistence/persistence.ts'
import { Entry } from '@commitspark/git-adapter'
import { getReferencingEntryIds } from '../../schema-utils/entry-reference-util.ts'
import { QueryMutationResolver } from '../types.ts'
import { createError, ErrorCode } from '../../errors.ts'
import { getCommitMessage } from './commit-message.ts'
import { assertExpectedVersion, commitWithRetry } from './commit-with-retry.ts'

export const mutationDeleteResolver: QueryMutationResolver<string> = async (
  source,
  args,
  context,
  info,
) => {
  await commitWithRetry(context, async () => {
    const entry: Entry = await findByTypeId(context, context.type.name, args.id)
    await assertExpectedVersion(context, args.id, args.expectedVersion)

    // references held by the entry itself are deleted together with the entry
    const otherReferencingIds = (
      await getReferencingEntryIds(context, info.schema, args.id)
    ).filter((referencingId) => referencingId !== args.id)
    if (otherReferencingIds.length > 0) {
      const otherIds = otherReferencingIds
        .map((referenceId) => `"${referenceId}"`)
        .join(', ')
      throw createError(
        `Entry with ID "${args.id}" is still referenced by entries [${otherIds}].`,
        ErrorCode.IN_USE,
        {
          argumentName: 'id',
          argumentValue: args.id,
        },
      )
    }

    return {
      ref: context.branch,
      parentSha: context.getCurrentHash(),
      entries: [
        {
          ...entry,
          deletion: true,
        },
      ],
      message: getCommitMessage(
        args.commitMessage,
        'Delete',
        context.type.name,
        args.id,
      ),
    }
  })

  return args.id
}
