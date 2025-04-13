import { PersistenceService } from '../../persistence/persistence.service'
import { GraphQLFieldResolver } from 'graphql'
import { ApolloContext } from '../../app/api.service'

export class QueryTypeByIdResolverGenerator {
  constructor(private readonly persistence: PersistenceService) {}

  public createResolver(): GraphQLFieldResolver<
    any,
    ApolloContext,
    any,
    Promise<string>
  > {
    return async (
      source,
      args,
      context: ApolloContext,
      info,
    ): Promise<string> => {
      return this.persistence.getTypeById(
        context.gitAdapter,
        context.getCurrentRef(),
        args.id,
      )
    }
  }
}
