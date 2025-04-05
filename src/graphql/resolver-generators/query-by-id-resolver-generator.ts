import { EntryData } from '@commitspark/git-adapter'
import { PersistenceService } from '@/persistence/persistence.service'
import { GraphQLFieldResolver } from 'graphql'
import { ApolloContext } from '@/app/api.service'

export class QueryByIdResolverGenerator {
  constructor(private readonly persistence: PersistenceService) {}

  public createResolver(
    typeName: string,
  ): GraphQLFieldResolver<any, ApolloContext, any, Promise<EntryData>> {
    return async (obj, args, context, info): Promise<EntryData> => {
      const entry = await this.persistence.findByTypeId(
        context.gitAdapter,
        context.getCurrentRef(),
        typeName,
        args.id,
      )

      return { ...entry.data, id: entry.id }
    }
  }
}
