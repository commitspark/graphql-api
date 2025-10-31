import { EntryData } from '@commitspark/git-adapter'
import { FieldResolver, ResolvedEntryData } from './types'
import {
  getUnionTypeNameFromFieldValue,
  getUnionValue,
} from '../../schema-utils/union-type-util'

export const resolveUnionValue: FieldResolver<any> = (
  fieldValue: any,
): Promise<ResolvedEntryData<EntryData | EntryData[] | null>> => {
  const typeName = getUnionTypeNameFromFieldValue(fieldValue)
  const unionValue = getUnionValue(fieldValue)

  // We replace the helper type name field that holds our field's actual data
  // with this actual data and add a `__typename` field, so that our output data
  // corresponds to the output schema provided by the user (i.e. there is
  // no additional nesting level there).
  const res: EntryData = {
    ...unionValue,
    __typename: typeName,
  }

  return new Promise((resolve) => resolve(res))
}
