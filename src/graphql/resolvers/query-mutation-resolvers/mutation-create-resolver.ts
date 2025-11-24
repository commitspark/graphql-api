import { findById, findByTypeId } from '../../../persistence/persistence'
import { GraphQLFieldResolver, isObjectType } from 'graphql'
import { getReferencedEntryIds } from '../../schema-utils/entry-reference-util'
import {
  ENTRY_ID_INVALID_CHARACTERS,
  EntryData,
  EntryDraft,
} from '@commitspark/git-adapter'
import { QueryMutationResolverContext } from '../types'
import { createError, ErrorCode } from '../../errors'

export const mutationCreateResolver: GraphQLFieldResolver<
  any,
  QueryMutationResolverContext,
  any,
  Promise<EntryData>
> = async (source, args, context, info) => {
  if (!isObjectType(context.type)) {
    throw createError(
      `Entry of type "${context.type.name}" cannot be created as is not an ObjectType.`,
      ErrorCode.INTERNAL_ERROR,
      {},
    )
  }

  const idValidationResult = args.id.match(ENTRY_ID_INVALID_CHARACTERS)
  if (idValidationResult) {
    throw createError(
      `Field "id" contains invalid characters "${idValidationResult.join(
        ', ',
      )}".`,
      ErrorCode.BAD_USER_INPUT,
      {
        argumentName: 'id',
        argumentValue: args.id,
      },
    )
  }

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

  const referencedEntryIds = await getReferencedEntryIds(
    context.type,
    context,
    null,
    info.returnType,
    args.data,
  )

  const referencedEntryUpdates: EntryDraft[] = []
  for (const referencedEntryId of referencedEntryIds) {
    const referencedEntry = await findById(context, referencedEntryId)
    const newReferencedEntryIds: string[] = [
      ...(referencedEntry.metadata.referencedBy ?? []),
      args.id,
    ].sort()
    const newReferencedEntryDraft: EntryDraft = {
      ...referencedEntry,
      metadata: {
        ...referencedEntry.metadata,
        referencedBy: newReferencedEntryIds,
      },
      deletion: false,
    }
    referencedEntryUpdates.push(newReferencedEntryDraft)
  }

  const newEntryDraft: EntryDraft = {
    id: args.id,
    metadata: {
      type: context.type.name,
      referencedBy: [],
    },
    data: args.data,
    deletion: false,
  }

  const commit = await context.gitAdapter.createCommit({
    ref: context.branch,
    parentSha: context.getCurrentHash(),
    entries: [newEntryDraft, ...referencedEntryUpdates],
    message: args.commitMessage,
  })
  context.setCurrentHash(commit.ref)

  const newEntry = await findByTypeId(context, context.type.name, args.id)
  return { ...newEntry.data, id: newEntry.id }
}
