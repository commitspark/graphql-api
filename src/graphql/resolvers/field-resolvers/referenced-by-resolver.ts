import { getReferencingEntryIds } from '../../schema-utils/entry-reference-util.ts'
import { ReferencedByResolver } from '../types.ts'

export const referencedByResolver: ReferencedByResolver = async (
  source,
  _args,
  context,
  info,
) => getReferencingEntryIds(context, info.schema, source.id)
