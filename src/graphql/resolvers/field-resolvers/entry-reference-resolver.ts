import { FieldResolver, FieldResolverContext } from './types'
import { GraphQLResolveInfo, isNamedType } from 'graphql'
import { findById } from '../../../persistence/persistence'
import { createError, ErrorCode } from '../../errors'

export const resolveEntryReference: FieldResolver<any> = async (
  fieldValue: any,
  args: any,
  context: FieldResolverContext,
  info: GraphQLResolveInfo,
) => {
  if (!isNamedType(context.currentType)) {
    throw createError(
      `Expected context.currentType type to be a named type.`,
      ErrorCode.INTERNAL_ERROR,
      {
        fieldValue: fieldValue,
      },
    )
  }

  const entry = await findById(context, fieldValue.id)

  return { ...entry.data, id: entry.id }
}
