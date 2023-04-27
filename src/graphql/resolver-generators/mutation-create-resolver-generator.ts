import { GraphQLFieldResolver } from 'graphql/type/definition'
import { ApolloContext } from '../../app/api.service'
import {
  Entry,
  PersistenceService,
} from '../../persistence/persistence.service'

export class MutationCreateResolverGenerator {
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
      const createResult = await this.persistence.createType(
        context.gitAdapter,
        context.branch,
        context.getCurrentRef(),
        typeName,
        args.data,
        args.message,
      )
      context.setCurrentRef(createResult.ref)
      return this.persistence.findByTypeId(
        context.gitAdapter,
        context.getCurrentRef(),
        typeName,
        createResult.id,
      )
    }
  }
}
