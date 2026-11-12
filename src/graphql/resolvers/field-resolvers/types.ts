import { EntryData } from '@commitspark/git-adapter'

/**
 * Value returned by field resolvers. Elements of lists may be promises, so that GraphQL completes every element on its
 * own and applies the nullability of the element type to errors of single elements.
 */
export type ResolvedValue =
  | EntryData
  | string
  | number
  | boolean
  | null
  | Array<ResolvedValue | Promise<ResolvedValue>>
