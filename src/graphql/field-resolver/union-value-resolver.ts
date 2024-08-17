import { GraphQLFieldResolver } from 'graphql/type/definition'
import { EntryData } from '@commitspark/git-adapter'
import {
  FieldResolver,
  ResolvedEntryData,
  FieldResolverContext,
} from './fieldResolver'
import { UnionTypeUtil } from '../schema-utils/union-type-util'

export class UnionValueResolver implements FieldResolver<any> {
  resolve: GraphQLFieldResolver<
    any,
    FieldResolverContext,
    any,
    Promise<ResolvedEntryData<EntryData | EntryData[] | null>>
  >

  constructor(private readonly unionTypeUtil: UnionTypeUtil) {
    this.resolve = (
      fieldValue,
      args,
      context,
      info,
    ): Promise<ResolvedEntryData<EntryData | EntryData[] | null>> =>
      this.resolveFieldValue(fieldValue)
  }

  private resolveFieldValue(
    fieldValue: any,
  ): Promise<ResolvedEntryData<EntryData | EntryData[] | null>> {
    const typeName =
      this.unionTypeUtil.getUnionTypeNameFromFieldValue(fieldValue)
    const unionValue = this.unionTypeUtil.getUnionValue(fieldValue)

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
}
