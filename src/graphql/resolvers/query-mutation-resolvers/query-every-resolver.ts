import { EntryData } from '@commitspark/git-adapter'
import { findByType } from '../../../persistence/persistence'
import { GraphQLFieldResolver } from 'graphql'
import { QueryMutationResolverContext } from '../types'

export const queryEveryResolver: GraphQLFieldResolver<
  any,
  QueryMutationResolverContext,
  any,
  Promise<EntryData[]>
> = async (_obj, _args, context, info) => {
  void info
  const entries = await findByType(context, context.type.name)

  return entries.map((entry) => {
    return { ...entry.data, id: entry.id }
  })
}
