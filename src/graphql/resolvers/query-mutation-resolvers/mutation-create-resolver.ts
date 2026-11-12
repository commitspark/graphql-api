import { findById, findByTypeId } from '../../../persistence/persistence.ts'
import { isObjectType } from 'graphql'
import {
  EntryData,
  EntryDraft,
  validateEntryId,
} from '@commitspark/git-adapter'
import { QueryMutationResolver } from '../types.ts'
import { createError, ErrorCode } from '../../errors.ts'
import { getCommitMessage } from '../commit-message.ts'
import { commitWithRetry } from '../../../persistence/commit-with-retry.ts'
import { assertValidEntryDrafts } from '../../../validation/repository-validator.ts'
import { createEntrySource } from '../entry-data-source.ts'

export const mutationCreateResolver: QueryMutationResolver<EntryData> = async (
  source,
  args,
  context,
  info,
) => {
  if (!isObjectType(context.type)) {
    throw createError(
      `Entry of type "${context.type.name}" cannot be created as is not an ObjectType.`,
      ErrorCode.INTERNAL_ERROR,
      {},
    )
  }
  try {
    validateEntryId(args.id)
  } catch (err) {
    throw createError(
      err instanceof Error ? err.message : String(err),
      ErrorCode.BAD_USER_INPUT,
      {
        argumentName: 'id',
        argumentValue: args.id,
      },
    )
  }
  const commitMessage = getCommitMessage(
    args.commit,
    'Create',
    context.type.name,
    args.id,
  )

  await commitWithRetry(context, async () => {
    let existingEntry
    try {
      existingEntry = await findById(context, args.id)
    } catch {}
    if (existingEntry) {
      throw createError(
        `An entry with id "${args.id}" already exists.`,
        ErrorCode.BAD_USER_INPUT,
        {
          argumentName: 'id',
          argumentValue: args.id,
        },
      )
    }

    const newEntryDraft: EntryDraft = {
      id: args.id,
      metadata: {
        type: context.type.name,
      },
      data: args.data ?? null,
      deletion: false,
    }
    await assertValidEntryDrafts(context, info.schema, [newEntryDraft])

    return {
      ref: context.branch,
      parentSha: context.getCurrentHash(),
      entries: [newEntryDraft],
      ...commitMessage,
    }
  })

  const newEntry = await findByTypeId(context, context.type.name, args.id)
  return createEntrySource(context, info.schema, newEntry)
}
