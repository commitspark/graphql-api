import { GraphQLFieldResolver } from 'graphql/type/definition'
import { ApolloContext } from '../../app/api.service'
import {
  Entry,
  PersistenceService,
} from '../../persistence/persistence.service'
import { GraphQLError } from 'graphql/error/GraphQLError'
import { EntryReferenceUtil } from '../schema-utils/entry-reference-util'
import { isObjectType } from 'graphql'
import {
  ContentEntryDraft,
  ENTRY_ID_INVALID_CHARACTERS,
} from '@commitspark/git-adapter'

export class MutationCreateResolverGenerator {
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
      let existingEntry
      try {
        existingEntry = await this.persistence.findById(
          context.gitAdapter,
          context.getCurrentRef(),
          args.id,
        )
      } catch (_) {}
      if (existingEntry) {
        throw new GraphQLError(`An entry with id "${args.id}" already exists`, {
          extensions: {
            code: 'BAD_USER_INPUT',
            argumentName: 'id',
          },
        })
      }

      if (!isObjectType(info.returnType)) {
        throw new Error('Expected to create an ObjectType')
      }

      const referencedEntryIds =
        await this.entryReferenceUtil.getReferencedEntryIds(
          info.returnType,
          context,
          null,
          info.returnType,
          args.data,
        )

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

      const referencedEntryUpdates: ContentEntryDraft[] = []
      for (const referencedEntryId of referencedEntryIds) {
        const referencedEntry = await this.persistence.findById(
          context.gitAdapter,
          context.getCurrentRef(),
          referencedEntryId,
        )
        const newReferencedEntryIds: string[] = [
          ...(referencedEntry.metadata.referencedBy ?? []),
          args.id,
        ].sort()
        const newReferencedEntryDraft: ContentEntryDraft = {
          ...referencedEntry,
          metadata: {
            ...referencedEntry.metadata,
            referencedBy: newReferencedEntryIds,
          },
          deletion: false,
        }
        referencedEntryUpdates.push(newReferencedEntryDraft)
      }

      const newEntryDraft: ContentEntryDraft = {
        id: args.id,
        metadata: {
          type: typeName,
          referencedBy: [],
        },
        data: args.data,
        deletion: false,
      }

      const commit = await context.gitAdapter.createCommit({
        ref: context.branch,
        parentSha: context.getCurrentRef(),
        contentEntries: [newEntryDraft, ...referencedEntryUpdates],
        message: args.message,
      })
      context.setCurrentRef(commit.ref)

      const newEntry = await this.persistence.findByTypeId(
        context.gitAdapter,
        context.getCurrentRef(),
        typeName,
        args.id,
      )
      return { ...newEntry.data, id: newEntry.id }
    }
  }
}
