import {
  Entry,
  PersistenceService,
} from '../../persistence/persistence.service'
import { GraphQLFieldResolver } from 'graphql/type/definition'
import { ApolloContext } from '../../app/api.service'
import { EntryReferenceUtil } from '../schema-utils/entry-reference-util'
import { isObjectType } from 'graphql'
import { ContentEntryData, ContentEntryDraft } from '@commitspark/git-adapter'

export class MutationUpdateResolverGenerator {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly entryReferenceUtil: EntryReferenceUtil,
  ) {}

  public createResolver(
    typeName: string,
  ): GraphQLFieldResolver<any, ApolloContext, any, Promise<Entry>> {
    return async (
      source,
      args,
      context: ApolloContext,
      info,
    ): Promise<Entry> => {
      if (!isObjectType(info.returnType)) {
        throw new Error('Expected to update an ObjectType')
      }

      const existingEntry = await this.persistence.findByTypeId(
        context.gitAdapter,
        context.getCurrentRef(),
        typeName,
        args.id,
      )

      const existingReferencedEntryIds =
        await this.entryReferenceUtil.getReferencedEntryIds(
          info.returnType,
          context,
          null,
          info.returnType,
          existingEntry.data,
        )

      const mergedData = this.mergeData(existingEntry.data ?? null, args.data)
      const updatedReferencedEntryIds =
        await this.entryReferenceUtil.getReferencedEntryIds(
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

      const referencedEntryUpdates: ContentEntryDraft[] = []
      for (const noLongerReferencedEntryId of noLongerReferencedIds) {
        const noLongerReferencedEntry = await this.persistence.findById(
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
        const newlyReferencedEntry = await this.persistence.findById(
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
        contentEntries: [
          { ...existingEntry, data: mergedData, deletion: false },
          ...referencedEntryUpdates,
        ],
        message: args.message,
      })
      context.setCurrentRef(commit.ref)

      const updatedEntry = await this.persistence.findByTypeId(
        context.gitAdapter,
        context.getCurrentRef(),
        typeName,
        args.id,
      )
      return { ...updatedEntry.data, id: updatedEntry.id }
    }
  }

  private mergeData(
    existingEntryData: ContentEntryData,
    updateData: ContentEntryData,
  ): ContentEntryData {
    return {
      ...existingEntryData,
      ...updateData,
    }
  }
}
