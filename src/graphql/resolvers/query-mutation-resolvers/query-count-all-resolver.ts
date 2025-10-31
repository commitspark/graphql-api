import { findByType } from '../../../persistence/persistence.service'
import { GraphQLFieldResolver } from 'graphql'
import { TypeCount } from '../../queries-mutations-generator'
import { QueryMutationResolverContext } from '../types'

export const queryCountAllResolver: GraphQLFieldResolver<
  any,
  QueryMutationResolverContext,
  any,
  Promise<TypeCount>
> = async (obj, args, context, info) => {
  return {
    count: (
      await findByType(
        context.gitAdapter,
        context.getCurrentRef(),
        context.type.name,
      )
    ).length,
  }
}
