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
    // the field value resolver adds field `__typename` to the value of an inline union, naming its member type
    return source.__typename
  }
}
