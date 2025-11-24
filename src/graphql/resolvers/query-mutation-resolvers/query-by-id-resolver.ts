import { EntryData } from '@commitspark/git-adapter'
import { findByTypeId } from '../../../persistence/persistence'
import { GraphQLFieldResolver } from 'graphql'
import { QueryMutationResolverContext } from '../types'

export const queryByIdResolver: GraphQLFieldResolver<
  any,
  QueryMutationResolverContext,
  any,
  Promise<EntryData>
> = async (_obj, args, context, info) => {
  void info
  const entry = await findByTypeId(context, context.type.name, args.id)

  return { ...entry.data, id: entry.id }
}
