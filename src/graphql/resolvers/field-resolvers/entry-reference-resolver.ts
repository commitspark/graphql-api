import { FieldResolver, FieldResolverContext } from './types'
import { GraphQLResolveInfo, isNamedType } from 'graphql'
import { findById } from '../../../persistence/persistence.service'

export const resolveEntryReference: FieldResolver<any> = async (
  fieldValue: any,
  args: any,
  context: FieldResolverContext,
  info: GraphQLResolveInfo,
) => {
  if (!isNamedType(context.currentType)) {
    throw new Error(`Expected context.currentType type to be named type`)
  }

  const entry = await findById(
    context.gitAdapter,
    context.getCurrentRef(),
    fieldValue.id,
  )

  return { ...entry.data, id: entry.id }
}
