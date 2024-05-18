import {
  FieldResolver,
  ResolvedEntryData,
  FieldResolverContext,
} from './fieldResolver'
import { Entry } from '../../persistence/persistence.service'
import {
  GraphQLFieldResolver,
  GraphQLOutputType,
  GraphQLResolveInfo,
} from 'graphql/type/definition'
import {
  GraphQLNonNull,
  GraphQLUnionType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { EntryReferenceUtil } from '../schema-utils/entry-reference-util'
import { UnionValueResolver } from './union-value-resolver'
import { EntryReferenceResolver } from './entry-reference-resolver'

export class FieldDefaultValueResolver implements FieldResolver<any> {
  resolve: GraphQLFieldResolver<
    any,
    FieldResolverContext,
    any,
    Promise<ResolvedEntryData<Entry | Entry[] | null>>
  >

  constructor(
    private readonly entryReferenceUtil: EntryReferenceUtil,
    private readonly unionValueResolver: UnionValueResolver,
    private readonly entryReferenceResolver: EntryReferenceResolver,
  ) {
    this.resolve = (
      fieldValue,
      args,
      context,
      info,
    ): Promise<ResolvedEntryData<Entry | Entry[] | null>> =>
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
  ): Promise<ResolvedEntryData<Entry | Entry[] | null>> {
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

      if (this.entryReferenceUtil.buildsOnTypeWithEntryDirective(currentType)) {
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

      if (this.entryReferenceUtil.hasEntryDirective(currentType)) {
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
