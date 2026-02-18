import { EntryData } from '@commitspark/git-adapter'
import { findByTypeId } from '../../../persistence/persistence.ts'
import { GraphQLFieldResolver } from 'graphql'
import { QueryMutationResolverContext } from '../types.ts'

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
