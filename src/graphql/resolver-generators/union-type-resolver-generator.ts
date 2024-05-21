import { ApolloContext } from '../../app/api.service'
import { PersistenceService } from '../../persistence/persistence.service'
import {
  GraphQLAbstractType,
  GraphQLResolveInfo,
  GraphQLTypeResolver,
} from 'graphql/type/definition'
import { EntryReferenceUtil } from '../schema-utils/entry-reference-util'

export class UnionTypeResolverGenerator {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly entryReferenceUtil: EntryReferenceUtil,
  ) {}

  public createResolver(): GraphQLTypeResolver<any, ApolloContext> {
    return async (
      obj: any,
      context: ApolloContext,
      info: GraphQLResolveInfo,
      abstractType: GraphQLAbstractType,
    ): Promise<string> => {
      if (
        this.entryReferenceUtil.buildsOnTypeWithEntryDirective(abstractType)
      ) {
        return this.persistence.getTypeById(
          context.gitAdapter,
          context.getCurrentRef(),
          obj.id,
        )
      } else {
        // We have injected an internal `__typename` field into the data of fields pointing to a non-entry union
        // in UnionValueResolver. This artificial field holds the type information we need here.
        return obj.__typename
      }

      // TODO same for interface type: https://www.apollographql.com/docs/apollo-server/data/resolvers/#resolving-unions-and-interfaces
    }
  }
}
