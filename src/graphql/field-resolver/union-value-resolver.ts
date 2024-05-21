import { GraphQLFieldResolver } from 'graphql/type/definition'
import { Entry } from '../../persistence/persistence.service'
import {
  FieldResolver,
  ResolvedEntryData,
  FieldResolverContext,
} from './fieldResolver'

export class UnionValueResolver implements FieldResolver<any> {
  resolve: GraphQLFieldResolver<
    any,
    FieldResolverContext,
    any,
    Promise<ResolvedEntryData<Entry | Entry[] | null>>
  >

  constructor() {
    this.resolve = (
      fieldValue,
      args,
      context,
      info,
    ): Promise<ResolvedEntryData<Entry | Entry[] | null>> =>
      this.resolveFieldValue(fieldValue)
  }

  private resolveFieldValue(
    fieldValue: any,
  ): Promise<ResolvedEntryData<Entry | Entry[] | null>> {
    // Based on our @oneOf directive, we expect only one field whose name
    // corresponds to the concrete type's name.
    const firstKey = Object.keys(fieldValue)[0]
    if (Array.isArray(fieldValue)) {
      throw new Error('Did not expect array value')
    }

    // We replace the above name field that nests our concrete data directly
    // with the data and a `__typename` field, so that our output data
    // corresponds to the output schema provided by the user (i.e. there is
    // no additional nesting level there).
    return {
      ...fieldValue[firstKey],
      __typename: firstKey.slice(0, 1).toUpperCase() + firstKey.slice(1),
    }
  }
}
