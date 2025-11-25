import { getTypeById } from '../../../persistence/persistence'
import { GraphQLFieldResolver } from 'graphql'
import { ApolloContext } from '../../../client'

export const queryTypeByIdResolver: GraphQLFieldResolver<
  any,
  ApolloContext,
  any,
  Promise<string>
> = async (_source, args, context, info) => {
  void info
  return getTypeById(context, args.id)
}
