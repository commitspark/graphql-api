import {
  getSchema,
  GraphQLRequest,
  GraphQLResponse,
  migrate,
  postGraphQL,
  removeUnknownFields,
  SchemaResponse,
  validate,
  VariableValues,
} from './client.ts'
import { Entry, EntryDraft, GitAdapter } from '@commitspark/git-adapter'
import { SearchAdapter } from '@commitspark/search-adapter'
import { ErrorCode, ErrorMetadata } from './graphql/errors.ts'
import { createCacheHandler } from './persistence/cache.ts'
import {
  ValidationResult,
  Violation,
  ViolationCode,
  ViolationSeverity,
} from './validation/violation.ts'
import {
  MigrationFn,
  MigrationResponse,
  MigrationResult,
  MigrationSnapshot,
} from './migration/migrate.ts'
import { CommitInput } from './graphql/resolvers/types.ts'

interface Client {
  postGraphQL<
    TData = Record<string, unknown>,
    TVariables extends VariableValues = VariableValues,
  >(
    ref: string,
    request: GraphQLRequest<TData, TVariables>,
  ): Promise<GraphQLResponse<TData | null>>
  getSchema(ref: string): Promise<SchemaResponse>
  /**
   * Validates the schema and all entries at the given ref against the schema. Returns all violations found instead
   * of failing on the first one, e.g. to check a repository in CI after changing the schema.
   */
  validate(ref: string): Promise<ValidationResult>
  /**
   * Runs `migration` on a snapshot of the head of `branch` and commits the returned schema and entries in a single
   * commit, e.g. to rename a field in the schema and in all entries, or to change entries that reference each other.
   * The result is validated before committing and nothing is committed if it has errors. If the branch moves before
   * committing, `migration` is run again on the new head, so it must only depend on the snapshot.
   */
  migrate(branch: string, migration: MigrationFn): Promise<MigrationResponse>
  /**
   * Removes all data stored under keys that are not fields in the schema and all metadata except the entry type from
   * the entries of `branch`, in a single commit.
   */
  removeUnknownFields(
    branch: string,
    commit?: CommitInput,
  ): Promise<MigrationResponse>
}

interface ClientOptions {
  /**
   * Enables query `_search` when set.
   */
  searchAdapter?: SearchAdapter
}

export {
  Client,
  ClientOptions,
  GraphQLResponse,
  SchemaResponse,
  ErrorCode,
  ErrorMetadata,
  GraphQLRequest,
  ValidationResult,
  Violation,
  ViolationCode,
  ViolationSeverity,
  MigrationFn,
  MigrationSnapshot,
  MigrationResult,
  MigrationResponse,
  CommitInput,
  Entry,
  EntryDraft,
}

export async function createClient(
  gitAdapter: GitAdapter,
  options: ClientOptions = {},
): Promise<Client> {
  const repositoryCache = createCacheHandler()
  const searchAdapter = options.searchAdapter
  return {
    postGraphQL: (...args) =>
      postGraphQL(gitAdapter, searchAdapter, repositoryCache, ...args),
    getSchema: (...args) =>
      getSchema(gitAdapter, searchAdapter, repositoryCache, ...args),
    validate: (...args) =>
      validate(gitAdapter, searchAdapter, repositoryCache, ...args),
    migrate: (...args) =>
      migrate(gitAdapter, searchAdapter, repositoryCache, ...args),
    removeUnknownFields: (...args) =>
      removeUnknownFields(gitAdapter, searchAdapter, repositoryCache, ...args),
  }
}
