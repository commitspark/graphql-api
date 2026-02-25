import { getTypeById } from '../../../persistence/persistence.ts'
import { QueryMutationResolver } from '../types.ts'

export const queryTypeByIdResolver: QueryMutationResolver<string> = async (
  _source,
  args,
  context,
  info,
) => {
  void info
  return getTypeById(context, args.id)
}
