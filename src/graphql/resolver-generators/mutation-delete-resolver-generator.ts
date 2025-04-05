import { PersistenceService } from '@/persistence/persistence.service'
import { ApolloContext } from '@/app/api.service'
import { Entry, EntryData, EntryDraft } from '@commitspark/git-adapter'
import { EntryReferenceUtil } from '@/graphql/schema-utils/entry-reference-util'
import { GraphQLError, GraphQLFieldResolver, isObjectType } from 'graphql'

export class MutationDeleteResolverGenerator {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly entryReferenceUtil: EntryReferenceUtil,
  ) {}

  public createResolver(
    typeName: string,
  ): GraphQLFieldResolver<any, ApolloContext, any, Promise<EntryData>> {
    return async (
      source,
      args,
      context: ApolloContext,
      info,
    ): Promise<EntryData> => {
      const entry: Entry = await this.persistence.findByTypeId(
        context.gitAdapter,
        context.getCurrentRef(),
        typeName,
        args.id,
      )

      if (
        entry.metadata.referencedBy &&
        entry.metadata.referencedBy.length > 0
      ) {
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

      const entryType = info.schema.getType(typeName)
      if (!isObjectType(entryType)) {
        throw new Error('Expected to delete an ObjectType')
      }

      const referencedEntryIds =
        await this.entryReferenceUtil.getReferencedEntryIds(
          entryType,
          context,
          null,
          entryType,
          entry.data,
        )
      const referencedEntryUpdates: EntryDraft[] = []
      for (const referencedEntryId of referencedEntryIds) {
        const noLongerReferencedEntry = await this.persistence.findById(
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
  }
}
