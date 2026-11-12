/**
 * Names of types and fields that Commitspark adds to the user's schema. Generators and the schema validator both use
 * these functions, so that the validator checks exactly the names that are generated.
 */

export const QUERY_TYPE_NAME = 'Query'
export const MUTATION_TYPE_NAME = 'Mutation'
// not generated, but reserved, as a user type with this name would become the root type for subscriptions
export const SUBSCRIPTION_TYPE_NAME = 'Subscription'
export const COMMIT_INPUT_TYPE_NAME = '_CommitInput'
export const SEARCH_HIT_TYPE_NAME = '_SearchHit'

export const TYPE_NAME_QUERY_NAME = '_typeName'
export const SEARCH_QUERY_NAME = '_search'

export const REFERENCED_BY_FIELD_NAME = '_referencedBy'
export const VERSION_FIELD_NAME = '_version'

/**
 * Name of the input type for data of an object type or of a union of object types without `@Entry` directive.
 */
export const inputTypeName = (typeName: string): string => `${typeName}Input`

/**
 * Name of the input type for references to an `@Entry` type or to a union of `@Entry` types.
 */
export const idInputTypeName = (typeName: string): string =>
  `${typeName}IdInput`

// The semantics of `every` aren't a perfect replacement of `all` but this way we don't need to do non-trivial
// pluralization of user-provided type names
export const queryEveryName = (entryTypeName: string): string =>
  `every${entryTypeName}`

export const queryByIdName = (entryTypeName: string): string => entryTypeName

export const createMutationName = (entryTypeName: string): string =>
  `create${entryTypeName}`

export const updateMutationName = (entryTypeName: string): string =>
  `update${entryTypeName}`

export const deleteMutationName = (entryTypeName: string): string =>
  `delete${entryTypeName}`
