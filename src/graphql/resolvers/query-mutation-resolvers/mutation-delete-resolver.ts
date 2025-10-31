import {
  findById,
  findByTypeId,
} from '../../../persistence/persistence.service'
import { Entry, EntryData, EntryDraft } from '@commitspark/git-adapter'
import { getReferencedEntryIds } from '../../schema-utils/entry-reference-util'
import { GraphQLError, GraphQLFieldResolver, isObjectType } from 'graphql'
import { QueryMutationResolverContext } from '../types'

export const mutationDeleteResolver: GraphQLFieldResolver<
  any,
  QueryMutationResolverContext,
  any,
  Promise<EntryData>
> = async (source, args, context, info) => {
  const entry: Entry = await findByTypeId(
    context.gitAdapter,
    context.getCurrentRef(),
    context.type.name,
    args.id,
  )

  if (entry.metadata.referencedBy && entry.metadata.referencedBy.length > 0) {
    const otherIds = entry.metadata.referencedBy
      .map((referenceId) => `"${referenceId}"`)
      .join(', ')
    throw new GraphQLError(
      `Entry with id "${args.id}" is referenced by other entries: [${otherIds}]`,
      {
        extensions: {
          code: 'IN_USE',
          argumentName: 'id',
        },
      },
    )
  }

  const entryType = info.schema.getType(context.type.name)
  if (!isObjectType(entryType)) {
    throw new Error('Expected to delete an ObjectType')
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
    const noLongerReferencedEntry = await findById(
      context.gitAdapter,
      context.getCurrentRef(),
      referencedEntryId,
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

  const commit = await context.gitAdapter.createCommit({
    ref: context.branch,
    parentSha: context.getCurrentRef(),
    entries: [
      {
        ...entry,
        deletion: true,
      },
      ...referencedEntryUpdates,
    ],
    message: args.commitMessage,
  })
  context.setCurrentRef(commit.ref)

  return args.id
}
