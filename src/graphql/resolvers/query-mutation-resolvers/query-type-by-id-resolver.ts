import { getTypeById } from '../../../persistence/persistence.service'
import { GraphQLFieldResolver } from 'graphql'
import { ApolloContext } from '../../../client'

export const queryTypeByIdResolver: GraphQLFieldResolver<
  any,
  ApolloContext,
  any,
  Promise<string>
> = async (source, args, context, info) => {
  return getTypeById(context.gitAdapter, context.getCurrentRef(), args.id)
}
