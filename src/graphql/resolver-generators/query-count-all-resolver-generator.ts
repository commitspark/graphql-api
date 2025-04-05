import { PersistenceService } from '@/persistence/persistence.service'
import { GraphQLFieldResolver } from 'graphql'
import { ApolloContext } from '@/app/api.service'
import { TypeCount } from '@/graphql/queries-mutations-generator.service'

export class QueryCountAllResolverGenerator {
  constructor(private readonly persistence: PersistenceService) {}

  public createResolver(
    typeName: string,
  ): GraphQLFieldResolver<any, ApolloContext, any, Promise<TypeCount>> {
    return async (
      obj,
      args,
      context: ApolloContext,
      info,
    ): Promise<TypeCount> => {
      return {
        count: (
          await this.persistence.findByType(
            context.gitAdapter,
            context.getCurrentRef(),
            typeName,
          )
        ).length,
      }
    }
  }
}
