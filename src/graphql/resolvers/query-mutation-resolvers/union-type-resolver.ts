import { ApolloContext } from '../../../client'
import { getTypeById } from '../../../persistence/persistence.service'
import { GraphQLTypeResolver } from 'graphql'
import { buildsOnTypeWithEntryDirective } from '../../schema-utils/entry-type-util'

export const unionTypeResolver: GraphQLTypeResolver<
  any,
  ApolloContext
> = async (obj, context, info, abstractType) => {
  if (buildsOnTypeWithEntryDirective(abstractType)) {
    return getTypeById(context.gitAdapter, context.getCurrentRef(), obj.id)
  } else {
    // We have injected an internal `__typename` field into the data of fields pointing to a non-entry union
    // in UnionValueResolver. This artificial field holds the type information we need here.
    return obj.__typename
  }

  // TODO same for interface type: https://www.apollographql.com/docs/apollo-server/data/resolvers/#resolving-unions-and-interfaces
}
