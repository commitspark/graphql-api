import {
  Entry,
  PersistenceService,
} from '../../persistence/persistence.service'
import { GraphQLFieldResolver } from 'graphql/type/definition'
import { ApolloContext } from '../../app/api.service'

export class MutationDeleteResolverGenerator {
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
      // TODO validate ID to delete is not referenced anywhere
      const deleteResult = await this.persistence.deleteByTypeId(
        context.gitAdapter,
        context.branch,
        context.getCurrentRef(),
        typeName,
        args.id,
        args.message,
      )
      context.setCurrentRef(deleteResult.ref)
      return {
        id: args.id,
      }
    }
  }
}
