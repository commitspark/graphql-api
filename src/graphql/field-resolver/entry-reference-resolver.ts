import {
  FieldResolver,
  ResolvedEntryData,
  FieldResolverContext,
} from './fieldResolver'
import {
  GraphQLFieldResolver,
  GraphQLOutputType,
  GraphQLResolveInfo,
} from 'graphql/type/definition'
import {
  Entry,
  PersistenceService,
} from '../../persistence/persistence.service'

export class EntryReferenceResolver implements FieldResolver<any> {
  resolve: GraphQLFieldResolver<
    any,
    FieldResolverContext,
    any,
    Promise<ResolvedEntryData<Entry | Entry[] | null>>
  >

  constructor(private readonly persistence: PersistenceService) {
    this.resolve = (
      fieldValue,
      args: any,
      context: FieldResolverContext,
      info,
    ): Promise<ResolvedEntryData<Entry | Entry[] | null>> =>
      this.resolveFieldValue(fieldValue, args, context, info, info.returnType)
  }

  private resolveFieldValue(
    fieldValue: any,
    args: any,
    context: FieldResolverContext,
    info: GraphQLResolveInfo,
    currentType: GraphQLOutputType,
  ): Promise<ResolvedEntryData<Entry | Entry[] | null>> {
    return this.persistence.findById(
      context.gitAdapter,
      context.getCurrentRef(),
      fieldValue.id,
    )
  }
}
