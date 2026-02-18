import { FieldResolver, FieldResolverContext } from './types.ts'
import { GraphQLResolveInfo, isNamedType } from 'graphql'
import { findById } from '../../../persistence/persistence.ts'
import { createError, ErrorCode } from '../../errors.ts'

export const resolveEntryReference: FieldResolver<any> = async (
  fieldValue: any,
  args: any,
  context: FieldResolverContext,
  info: GraphQLResolveInfo,
) => {
  void info
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
