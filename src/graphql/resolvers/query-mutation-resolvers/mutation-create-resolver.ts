import { findById, findByTypeId } from '../../../persistence/persistence'
import { GraphQLError, GraphQLFieldResolver, isObjectType } from 'graphql'
import { getReferencedEntryIds } from '../../schema-utils/entry-reference-util'
import {
  ENTRY_ID_INVALID_CHARACTERS,
  EntryData,
  EntryDraft,
} from '@commitspark/git-adapter'
import { QueryMutationResolverContext } from '../types'

export const mutationCreateResolver: GraphQLFieldResolver<
  any,
  QueryMutationResolverContext,
  any,
  Promise<EntryData>
> = async (source, args, context, info) => {
  if (!isObjectType(info.returnType)) {
    throw new Error('Expected to create an ObjectType')
  }

  const idValidationResult = args.id.match(ENTRY_ID_INVALID_CHARACTERS)
  if (idValidationResult) {
    throw new GraphQLError(
      `"id" contains invalid characters "${idValidationResult.join(', ')}"`,
      {
        extensions: {
          code: 'BAD_USER_INPUT',
          argumentName: 'id',
        },
      },
    )
  }

  let existingEntry
  try {
    existingEntry = await findById(
      context.gitAdapter,
      context.getCurrentRef(),
      args.id,
    )
  } catch (_) {
    /* empty */
  }
  if (existingEntry) {
    throw new GraphQLError(`An entry with id "${args.id}" already exists`, {
      extensions: {
        code: 'BAD_USER_INPUT',
        argumentName: 'id',
      },
    })
  }

  const referencedEntryIds = await getReferencedEntryIds(
    info.returnType,
    context,
    null,
    info.returnType,
    args.data,
  )

  const referencedEntryUpdates: EntryDraft[] = []
  for (const referencedEntryId of referencedEntryIds) {
    const referencedEntry = await findById(
      context.gitAdapter,
      context.getCurrentRef(),
      referencedEntryId,
    )
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
    parentSha: context.getCurrentRef(),
    entries: [newEntryDraft, ...referencedEntryUpdates],
    message: args.commitMessage,
  })
  context.setCurrentRef(commit.ref)

  const newEntry = await findByTypeId(
    context.gitAdapter,
    context.getCurrentRef(),
    context.type.name,
    args.id,
  )
  return { ...newEntry.data, id: newEntry.id }
}
