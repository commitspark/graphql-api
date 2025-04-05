import {
  FieldResolver,
  FieldResolverContext,
  ResolvedEntryData,
} from './fieldResolver'
import {
  GraphQLFieldResolver,
  GraphQLOutputType,
  GraphQLResolveInfo,
} from 'graphql'
import { PersistenceService } from '@/persistence/persistence.service'
import { EntryData } from '@commitspark/git-adapter'

export class EntryReferenceResolver implements FieldResolver<any> {
  resolve: GraphQLFieldResolver<
    any,
    FieldResolverContext,
    any,
    Promise<ResolvedEntryData<EntryData | EntryData[] | null>>
  >

  constructor(private readonly persistence: PersistenceService) {
    this.resolve = (
      fieldValue,
      args: any,
      context: FieldResolverContext,
      info,
    ): Promise<ResolvedEntryData<EntryData | EntryData[] | null>> =>
      this.resolveFieldValue(fieldValue, args, context, info, info.returnType)
  }

  private async resolveFieldValue(
    fieldValue: any,
    args: any,
    context: FieldResolverContext,
    info: GraphQLResolveInfo,
    currentType: GraphQLOutputType,
  ): Promise<ResolvedEntryData<EntryData | EntryData[] | null>> {
    const entry = await this.persistence.findById(
      context.gitAdapter,
      context.getCurrentRef(),
      fieldValue.id,
    )

    return { ...entry.data, id: entry.id }
  }
}
