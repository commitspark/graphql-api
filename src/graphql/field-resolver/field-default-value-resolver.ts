import {
  FieldResolver,
  FieldResolverContext,
  ResolvedEntryData,
} from './fieldResolver'
import { EntryData } from '@commitspark/git-adapter'
import {
  GraphQLFieldResolver,
  GraphQLNonNull,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLUnionType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { EntryTypeUtil } from '@/graphql/schema-utils/entry-type-util'
import { UnionValueResolver } from './union-value-resolver'
import { EntryReferenceResolver } from './entry-reference-resolver'

export class FieldDefaultValueResolver implements FieldResolver<any> {
  resolve: GraphQLFieldResolver<
    any,
    FieldResolverContext,
    any,
    Promise<ResolvedEntryData<EntryData | EntryData[] | null>>
  >

  constructor(
    private readonly entryTypeUtil: EntryTypeUtil,
    private readonly unionValueResolver: UnionValueResolver,
    private readonly entryReferenceResolver: EntryReferenceResolver,
  ) {
    this.resolve = (
      fieldValue,
      args,
      context,
      info,
    ): Promise<ResolvedEntryData<EntryData | EntryData[] | null>> =>
      this.resolveFieldValue(
        fieldValue,
        args,
        context,
        info,
        info.returnType,
        false,
      )
  }

  private resolveFieldValue(
    fieldValue: any,
    args: any,
    context: FieldResolverContext,
    info: GraphQLResolveInfo,
    currentType: GraphQLOutputType,
    hasNonNullParent: boolean,
  ): Promise<ResolvedEntryData<EntryData | EntryData[] | null>> {
    if (isNonNullType(currentType)) {
      return this.resolveFieldValue(
        fieldValue,
        args,
        {
          gitAdapter: context.gitAdapter,
          getCurrentRef: context.getCurrentRef,
        },
        info,
        currentType.ofType,
        true,
      )
    } else if (isListType(currentType)) {
      if (fieldValue === undefined || fieldValue === null) {
        if (hasNonNullParent) {
          return new Promise((resolve) => resolve([]))
        } else {
          return new Promise((resolve) => resolve(null))
        }
      }

      if (!Array.isArray(fieldValue)) {
        throw new Error(
          `Expected array while resolving value for field "${info.fieldName}".`,
        )
      }

      const resultPromises = []
      for (const item of fieldValue) {
        const resultPromise = this.resolveFieldValue(
          item,
          args,
          {
            gitAdapter: context.gitAdapter,
            getCurrentRef: context.getCurrentRef,
          },
          info,
          currentType.ofType,
          hasNonNullParent,
        )
        resultPromises.push(resultPromise)
      }
      return Promise.all(resultPromises)
    } else if (isUnionType(currentType)) {
      if (fieldValue === undefined || fieldValue === null) {
        if (hasNonNullParent) {
          throw new Error(
            `Cannot generate a default value for NonNull field "${
              info.parentType.name
            }.${info.fieldName}" because it is a union field of type "${
              (info.returnType as GraphQLNonNull<GraphQLUnionType>).ofType.name
            }".`,
          )
        } else {
          return new Promise((resolve) => resolve(null))
        }
      }

      if (this.entryTypeUtil.buildsOnTypeWithEntryDirective(currentType)) {
        return this.entryReferenceResolver.resolve(
          fieldValue,
          args,
          context,
          info,
        )
      }

      return this.unionValueResolver.resolve(fieldValue, args, context, info)
    } else if (isObjectType(currentType)) {
      if (fieldValue === undefined || fieldValue === null) {
        if (hasNonNullParent) {
          throw new Error(
            `Cannot generate a default value for NonNull field "${info.fieldName}" of type "${info.parentType.name}".`,
          )
        } else {
          return new Promise((resolve) => resolve(null))
        }
      }

      if (this.entryTypeUtil.hasEntryDirective(currentType)) {
        return this.entryReferenceResolver.resolve(
          fieldValue,
          args,
          context,
          info,
        )
      }

      return fieldValue
    }

    return fieldValue
  }
}
