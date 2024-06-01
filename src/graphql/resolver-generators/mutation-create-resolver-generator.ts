import { GraphQLFieldResolver } from 'graphql/type/definition'
import { ApolloContext } from '../../app/api.service'
import {
  Entry,
  PersistenceService,
} from '../../persistence/persistence.service'
import { GraphQLError } from 'graphql/error/GraphQLError'
import { EntryReferenceUtil } from '../schema-utils/entry-reference-util'
import { isObjectType } from 'graphql'

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
          info.returnType,
          args.data,
        )

      // TODO get all referenced entries
      // add ID of new entry to "referencedBy" metadata of referenced entries
      // create a single commit that creates the new entry and at the same time updates the existing entries

      const commitResult = await this.persistence.createType(
        context.gitAdapter,
        context.branch,
        context.getCurrentRef(),
        typeName,
        args.id,
        args.data,
        args.message,
      )
      context.setCurrentRef(commitResult.ref)

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
