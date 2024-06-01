import {
  Entry,
  PersistenceService,
} from '../../persistence/persistence.service'
import { GraphQLFieldResolver } from 'graphql/type/definition'
import { ApolloContext } from '../../app/api.service'

export class MutationUpdateResolverGenerator {
  constructor(private readonly persistence: PersistenceService) {}

  public createResolver(
    typeName: string,
  ): GraphQLFieldResolver<any, ApolloContext, any, Promise<Entry>> {
    return async (
      source,
      args,
      context: ApolloContext,
      info,
    ): Promise<Entry> => {
      const existingEntry = await this.persistence.findByTypeId(
        context.gitAdapter,
        context.getCurrentRef(),
        typeName,
        args.id,
      )

      // TODO validate ID references within args.data to assert referenced IDs exist and point to correct entry type
      // TODO also ensure that entries now referenced have their "referencedBy" metadata updated

      const updateResult = await this.persistence.update(
        context.gitAdapter,
        context.branch,
        context.getCurrentRef(),
        { ...existingEntry, data: args.data },
        args.message,
      )
      context.setCurrentRef(updateResult.ref)

      const updatedEntry = await this.persistence.findByTypeId(
        context.gitAdapter,
        context.getCurrentRef(),
        typeName,
        args.id,
      )
      return { ...updatedEntry.data, id: updatedEntry.id }
    }
  }
}
