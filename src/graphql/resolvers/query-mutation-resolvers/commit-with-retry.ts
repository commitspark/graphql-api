import {
  CommitDraft,
  ErrorCode as GitAdapterErrorCode,
  GitAdapterError,
} from '@commitspark/git-adapter'
import { ApolloContext } from '../../../client.ts'
import {
  callGitAdapter,
  toGraphQLError,
} from '../../../persistence/git-adapter-call.ts'
import { createError, ErrorCode } from '../../errors.ts'
import { getEntryVersion } from '../../../persistence/persistence.ts'

const MAX_COMMIT_ATTEMPTS = 3

/**
 * Commits a draft that `createDraft` validates against the current commit of the request, guaranteeing that the
 * draft is only committed on top of the exact commit it was validated against.
 *
 * Git adapters only move a branch if it still points to `parentSha` and otherwise throw `CONFLICT`. As most adapters
 * can only check this for the branch as a whole, any concurrent commit to the branch between reading and committing
 * leads to `CONFLICT`, even if it changed unrelated entries. In this case, the current commit of the request is moved
 * to the new branch head and the draft is created and validated again, including expected entry versions and
 * references, so that only actual conflicts are reported to the caller.
 *
 * Errors thrown by `createDraft` are not retried, as the draft was validated against the latest known state.
 */
export const commitWithRetry = async (
  context: ApolloContext,
  createDraft: () => Promise<CommitDraft>,
): Promise<void> => {
  for (let attempt = 1; ; attempt++) {
    const commitDraft = await createDraft()
    try {
      const commit = await context.gitAdapter.createCommit(commitDraft)
      context.setCurrentHash(commit.commitHash)
      return
    } catch (err) {
      const isConflict =
        err instanceof GitAdapterError &&
        err.code === GitAdapterErrorCode.CONFLICT
      if (!isConflict || attempt >= MAX_COMMIT_ATTEMPTS) {
        throw toGraphQLError(err)
      }
    }

    const headCommitHash = await callGitAdapter(() =>
      context.gitAdapter.getLatestCommitHash(context.branch),
    )
    context.setCurrentHash(headCommitHash)
  }
}

/**
 * Throws `CONFLICT` if an expected version is given and the entry has a different version at the current commit of
 * the request. This lets callers detect that an entry was changed by someone else since they read it, e.g. while a
 * user was editing the entry, instead of overwriting these changes.
 */
export const assertExpectedVersion = async (
  context: ApolloContext,
  id: string,
  expectedVersion: string | null | undefined,
): Promise<void> => {
  if (expectedVersion === undefined || expectedVersion === null) {
    return
  }
  const currentVersion = await getEntryVersion(context, id)
  if (currentVersion !== expectedVersion) {
    throw createError(
      `Entry with ID "${id}" has been changed: expected version "${expectedVersion}" but current version is ` +
        `"${currentVersion}".`,
      ErrorCode.CONFLICT,
      {
        argumentName: 'expectedVersion',
        argumentValue: expectedVersion,
      },
    )
  }
}
