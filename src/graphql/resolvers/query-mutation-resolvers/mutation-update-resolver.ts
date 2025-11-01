import { findById, findByTypeId } from '../../../persistence/persistence'
import { getReferencedEntryIds } from '../../schema-utils/entry-reference-util'
import { GraphQLFieldResolver, isObjectType } from 'graphql'
import { EntryData, EntryDraft } from '@commitspark/git-adapter'
import { QueryMutationResolverContext } from '../types'

function mergeData(
  existingEntryData: EntryData,
  updateData: EntryData,
): EntryData {
  return {
    ...existingEntryData,
    ...updateData,
  }
}

export const mutationUpdateResolver: GraphQLFieldResolver<
  any,
  QueryMutationResolverContext,
  any,
  Promise<EntryData>
> = async (source, args, context, info) => {
  if (!isObjectType(info.returnType)) {
    throw new Error('Expected to update an ObjectType')
  }

  const existingEntry = await findByTypeId(
    context.gitAdapter,
    context.getCurrentRef(),
    context.type.name,
    args.id,
  )

  const existingReferencedEntryIds = await getReferencedEntryIds(
    info.returnType,
    context,
    null,
    info.returnType,
    existingEntry.data,
  )

  const mergedData = mergeData(existingEntry.data ?? null, args.data)
  const updatedReferencedEntryIds = await getReferencedEntryIds(
    info.returnType,
    context,
    null,
    info.returnType,
    mergedData,
  )

  const noLongerReferencedIds = existingReferencedEntryIds.filter(
    (entryId) => !updatedReferencedEntryIds.includes(entryId),
  )
  const newlyReferencedIds = updatedReferencedEntryIds.filter(
    (entryId) => !existingReferencedEntryIds.includes(entryId),
  )

  const referencedEntryUpdates: EntryDraft[] = []
  for (const noLongerReferencedEntryId of noLongerReferencedIds) {
    const noLongerReferencedEntry = await findById(
      context.gitAdapter,
      context.getCurrentRef(),
      noLongerReferencedEntryId,
    )
    referencedEntryUpdates.push({
      ...noLongerReferencedEntry,
      metadata: {
        ...noLongerReferencedEntry.metadata,
        referencedBy: noLongerReferencedEntry.metadata.referencedBy?.filter(
          (entryId) => entryId !== args.id,
        ),
      },
      deletion: false,
    })
  }
  for (const newlyReferencedEntryId of newlyReferencedIds) {
    const newlyReferencedEntry = await findById(
      context.gitAdapter,
      context.getCurrentRef(),
      newlyReferencedEntryId,
    )
    const updatedReferenceList: string[] =
      newlyReferencedEntry.metadata.referencedBy ?? []
    updatedReferenceList.push(args.id)
    updatedReferenceList.sort()
    referencedEntryUpdates.push({
      ...newlyReferencedEntry,
      metadata: {
        ...newlyReferencedEntry.metadata,
        referencedBy: updatedReferenceList,
      },
      deletion: false,
    })
  }

  const commit = await context.gitAdapter.createCommit({
    ref: context.branch,
    parentSha: context.getCurrentRef(),
    entries: [
      { ...existingEntry, data: mergedData, deletion: false },
      ...referencedEntryUpdates,
    ],
    message: args.commitMessage,
  })
  context.setCurrentRef(commit.ref)

  const updatedEntry = await findByTypeId(
    context.gitAdapter,
    context.getCurrentRef(),
    context.type.name,
    args.id,
  )
  return { ...updatedEntry.data, id: updatedEntry.id }
}
