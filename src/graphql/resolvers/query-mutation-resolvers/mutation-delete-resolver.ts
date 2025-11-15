import { findById, findByTypeId } from '../../../persistence/persistence'
import { Entry, EntryData, EntryDraft } from '@commitspark/git-adapter'
import { getReferencedEntryIds } from '../../schema-utils/entry-reference-util'
import { GraphQLFieldResolver, isObjectType } from 'graphql'
import { QueryMutationResolverContext } from '../types'
import { createError, ErrorCode } from '../../errors'

export const mutationDeleteResolver: GraphQLFieldResolver<
  any,
  QueryMutationResolverContext,
  any,
  Promise<EntryData>
> = async (source, args, context, info) => {
  const entry: Entry = await findByTypeId(context, context.type.name, args.id)

  if (entry.metadata.referencedBy && entry.metadata.referencedBy.length > 0) {
    const otherIds = entry.metadata.referencedBy
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

  const entryType = info.schema.getType(context.type.name)
  if (!isObjectType(entryType)) {
    throw createError(
      `Type "${context.type.name}" is not an ObjectType.`,
      ErrorCode.INTERNAL_ERROR,
      {},
    )
  }

  const referencedEntryIds = await getReferencedEntryIds(
    entryType,
    context,
    null,
    entryType,
    entry.data,
  )
  const referencedEntryUpdates: EntryDraft[] = []
  for (const referencedEntryId of referencedEntryIds) {
    const noLongerReferencedEntry = await findById(context, referencedEntryId)
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

  const commit = await context.gitAdapter.createCommit({
    ref: context.branch,
    parentSha: context.getCurrentHash(),
    entries: [
      {
        ...entry,
        deletion: true,
      },
      ...referencedEntryUpdates,
    ],
    message: args.commitMessage,
  })
  context.setCurrentHash(commit.ref)

  return args.id
}
