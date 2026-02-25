import { getTypeById } from '../../../persistence/persistence.ts'
import { buildsOnTypeWithEntryDirective } from '../../schema-utils/entry-type-util.ts'
import { UnionTypeResolver } from '../types.ts'
import { createError, ErrorCode } from '../../errors.ts'

export const unionTypeResolver: UnionTypeResolver = async (
  source,
  context,
  info,
  abstractType,
) => {
  if (buildsOnTypeWithEntryDirective(abstractType)) {
    if (!('id' in source) || typeof source.id !== 'string') {
      throw createError(
        `Expected key "id" of type string in data while resolving reference-based union type for field "${info.fieldName}".`,
        ErrorCode.BAD_REPOSITORY_DATA,
        {
          typeName: abstractType.name,
          fieldName: info.fieldName,
        },
      )
    }
    return getTypeById(context, source.id)
  } else {
    // We have injected an internal `__typename` field into the data of fields pointing to a non-entry union
    // in UnionValueResolver. This artificial field holds the type information we need here.
    return source.__typename
  }

  // TODO same for interface type: https://www.apollographql.com/docs/apollo-server/data/resolvers/#resolving-unions-and-interfaces
}
