import { getTypeById } from '../../../persistence/persistence.ts'
import { buildsOnTypeWithEntryDirective } from '../../schema-utils/entry-type-util.ts'
import { UnionTypeResolver } from '../types.ts'

export const unionTypeResolver: UnionTypeResolver = async (
  source,
  context,
  _info,
  abstractType,
) => {
  if (buildsOnTypeWithEntryDirective(abstractType)) {
    // resolved references always carry the ID of the referenced entry
    return getTypeById(context, source.id as string)
  } else {
    // We have injected an internal `__typename` field into the data of fields pointing to a non-entry union
    // in UnionValueResolver. This artificial field holds the type information we need here.
    return source.__typename
  }
}
