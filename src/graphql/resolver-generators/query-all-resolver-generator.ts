import { ApolloContext } from '@/app/api.service'
import { EntryData } from '@commitspark/git-adapter'
import { PersistenceService } from '@/persistence/persistence.service'
import { GraphQLFieldResolver } from 'graphql'

export class QueryAllResolverGenerator {
  constructor(private readonly persistence: PersistenceService) {}

  public createResolver(
    typeName: string,
  ): GraphQLFieldResolver<any, ApolloContext, any, Promise<EntryData[]>> {
    return async (
      obj,
      args,
      context: ApolloContext,
      info,
    ): Promise<EntryData[]> => {
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
