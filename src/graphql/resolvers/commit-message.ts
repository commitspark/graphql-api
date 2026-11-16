import { CommitDraft } from '@commitspark/git-adapter'
import { createError, ErrorCode } from '../errors.ts'
import { CommitInput } from './types.ts'

type MutationOperation = 'Create' | 'Update' | 'Delete'

/**
 * Determines message and body of the commit of a mutation from mutation argument `commit`. The message is trimmed and
 * must be a single line; an omitted or empty message is replaced by a message generated from the mutation. The body
 * is trimmed and omitted if empty.
 */
export function getCommitMessage(
  commit: CommitInput | null | undefined,
  operation: MutationOperation,
  typeName: string,
  id: string,
): Pick<CommitDraft, 'message' | 'body'> {
  return getCommitMessageOrDefault(commit, `${operation} ${typeName} "${id}"`)
}

/**
 * Determines message and body of a commit from `commit`. The message is trimmed and must be a single line; an omitted
 * or empty message is replaced by `defaultMessage`. The body is trimmed and omitted if empty.
 */
export function getCommitMessageOrDefault(
  commit: CommitInput | null | undefined,
  defaultMessage: string,
): Pick<CommitDraft, 'message' | 'body'> {
  const message = commit?.message?.trim() ?? ''
  if (/[\r\n]/.test(message)) {
    throw createError(
      'Commit message must be a single line; use field "body" for details.',
      ErrorCode.BAD_USER_INPUT,
      { argumentName: 'commit.message', argumentValue: commit?.message },
    )
  }
  const body = commit?.body?.trim() ?? ''

  const commitMessage = message !== '' ? message : defaultMessage
  if (body === '') {
    return { message: commitMessage }
  }
  return { message: commitMessage, body: body }
}
