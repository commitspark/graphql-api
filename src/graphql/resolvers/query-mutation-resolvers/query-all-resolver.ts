import { EntryData } from '@commitspark/git-adapter'
import { findByType } from '../../../persistence/persistence.service'
import { GraphQLFieldResolver } from 'graphql'
import { QueryMutationResolverContext } from '../types'

export const queryAllResolver: GraphQLFieldResolver<
  any,
  QueryMutationResolverContext,
  any,
  Promise<EntryData[]>
> = async (obj, args, context, info) => {
  const entries = await findByType(
    context.gitAdapter,
    context.getCurrentRef(),
    context.type.name,
  )

  return entries.map((entry) => {
    return { ...entry.data, id: entry.id }
  })
}
