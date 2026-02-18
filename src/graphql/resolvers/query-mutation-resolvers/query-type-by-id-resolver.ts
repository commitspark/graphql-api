import { getTypeById } from '../../../persistence/persistence.ts'
import { GraphQLFieldResolver } from 'graphql'
import { ApolloContext } from '../../../client.ts'

export const queryTypeByIdResolver: GraphQLFieldResolver<
  any,
  ApolloContext,
  any,
  Promise<string>
> = async (_source, args, context, info) => {
  void info
  return getTypeById(context, args.id)
}
