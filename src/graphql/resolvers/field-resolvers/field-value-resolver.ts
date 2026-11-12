import {
  GraphQLOutputType,
  GraphQLResolveInfo,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { EntryData } from '@commitspark/git-adapter'
import { ApolloContext } from '../../../client.ts'
import { findById } from '../../../persistence/persistence.ts'
import { buildsOnTypeWithEntryDirective } from '../../schema-utils/entry-type-util.ts'
import {
  ENTRY_DIRECTIVE_NAME,
  hasDirective,
} from '../../schema-utils/directive-util.ts'
import {
  createEmbeddedSource,
  createEntrySource,
  DataSourceContext,
  throwViolationsAt,
} from '../entry-data-source.ts'
import { ResolvedValue } from './types.ts'

/**
 * Resolves the value at `path` within an entry. Violations of the entry data at this position are thrown here, so that
 * GraphQL reports them at the corresponding position of the response and applies the nullability of the schema: the
 * value becomes null if its type is nullable, otherwise the error propagates to the closest nullable parent.
 *
 * Values are returned synchronously where possible, as GraphQL completes promises considerably slower than values, and
 * only references to other entries are resolved asynchronously.
 */
export function resolveFieldValue(
  value: unknown,
  type: GraphQLOutputType,
  sourceContext: DataSourceContext,
  path: (string | number)[],
  context: ApolloContext,
  info: GraphQLResolveInfo,
): ResolvedValue | Promise<ResolvedValue> {
  throwViolationsAt(sourceContext, path)

  const nullableType = isNonNullType(type) ? type.ofType : type
  if (value === undefined || value === null) {
    return null
  }

  if (isListType(nullableType)) {
    // an error of an element is returned as rejected promise of this element instead of being thrown, so that GraphQL
    // applies the nullability of the element type to it instead of failing the whole list
    return (value as unknown[]).map((element, index) => {
      try {
        return resolveFieldValue(
          element,
          nullableType.ofType,
          sourceContext,
          [...path, index],
          context,
          info,
        )
      } catch (error) {
        return Promise.reject(error)
      }
    })
  }

  if (
    (isUnionType(nullableType) &&
      buildsOnTypeWithEntryDirective(nullableType)) ||
    (isObjectType(nullableType) &&
      hasDirective(nullableType, ENTRY_DIRECTIVE_NAME))
  ) {
    // existence and type of the referenced entry are checked by the validation of the referencing entry
    return findById(context, (value as { id: string }).id).then(
      (referencedEntry) =>
        createEntrySource(context, info.schema, referencedEntry),
    )
  }

  if (isUnionType(nullableType)) {
    // the value of an inline union is stored under the name of its member type; the type name is passed to the union
    // type resolver, so that the value itself has the shape of the member type
    const memberTypeName = Object.keys(value)[0]
    return createEmbeddedSource(
      sourceContext,
      (value as Record<string, EntryData>)[memberTypeName],
      [...path, memberTypeName],
      { __typename: memberTypeName },
    )
  }

  if (isObjectType(nullableType)) {
    return createEmbeddedSource(sourceContext, value as EntryData, path)
  }

  return value as ResolvedValue
}
