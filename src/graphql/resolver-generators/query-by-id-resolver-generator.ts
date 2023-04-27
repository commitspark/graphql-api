import {
  Entry,
  PersistenceService,
} from '../../persistence/persistence.service'
import { GraphQLFieldResolver } from 'graphql/type/definition'
import { ApolloContext } from '../../app/api.service'

export class QueryByIdResolverGenerator {
  constructor(private readonly persistence: PersistenceService) {}

  public createResolver(
    typeName: string,
  ): GraphQLFieldResolver<any, ApolloContext, any, Promise<Entry>> {
    return async (obj, args, context, info): Promise<Entry> => {
      return this.persistence.findByTypeId(
        context.gitAdapter,
        context.getCurrentRef(),
        typeName,
        args.id,
      )
    }
  }
}
