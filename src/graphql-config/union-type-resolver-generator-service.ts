import { Injectable } from '@nestjs/common'
import { ApolloContext } from '../app/api.service'
import { PersistenceService } from '../persistence/persistence.service'

@Injectable()
export class UnionTypeResolverGeneratorService {
  constructor(private readonly persistence: PersistenceService) {}

  public createResolver(): IUnionTypeResolver {
    const persistence = this.persistence
    return {
      async __resolveType(obj, context: ApolloContext, info): Promise<string> {
        // TODO same for interface type: https://www.apollographql.com/docs/apollo-server/data/resolvers/#resolving-unions-and-interfaces
        return persistence.getTypeById(
          context.gitAdapter,
          context.getCurrentRef(),
          obj.id,
        )
      },
    }
  }
}

export interface IUnionTypeResolver {
  __resolveType(obj, context: ApolloContext, info): Promise<string>
}
