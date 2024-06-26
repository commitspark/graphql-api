import { ApolloContext } from '../../app/api.service'
import {
  Entry,
  PersistenceService,
} from '../../persistence/persistence.service'
import { GraphQLFieldResolver } from 'graphql/type/definition'

export class QueryAllResolverGenerator {
  constructor(private readonly persistence: PersistenceService) {}

  public createResolver(
    typeName: string,
  ): GraphQLFieldResolver<any, ApolloContext, any, Promise<Entry[]>> {
    return async (
      obj,
      args,
      context: ApolloContext,
      info,
    ): Promise<Entry[]> => {
      const entries = await this.persistence.findByType(
        context.gitAdapter,
        context.getCurrentRef(),
        typeName,
      )

      return entries.map((entry) => {
        return { ...entry.data, id: entry.id }
      })
    }
  }
}
