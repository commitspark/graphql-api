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
      // TODO validate ID references in payload to assert referenced ID exists and points to correct entry type
      const updateResult = await this.persistence.updateByTypeId(
        context.gitAdapter,
        context.branch,
        context.getCurrentRef(),
        typeName,
        args.id,
        args.data,
        args.message,
      )
      context.setCurrentRef(updateResult.ref)
      return this.persistence.findByTypeId(
        context.gitAdapter,
        context.getCurrentRef(),
        typeName,
        args.id,
      )
    }
  }
}
