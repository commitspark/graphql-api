import { getEntryVersion } from '../../../persistence/persistence.ts'
import { VersionResolver } from '../types.ts'

export const versionResolver: VersionResolver = async (
  source,
  _args,
  context,
) => getEntryVersion(context, source.id)
