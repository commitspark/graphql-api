type MutationOperation = 'Create' | 'Update' | 'Delete'

export function getCommitMessage(
  commitMessage: string | null | undefined,
  operation: MutationOperation,
  typeName: string,
  id: string,
): string {
  const trimmedCommitMessage = commitMessage?.trim() ?? ''
  if (trimmedCommitMessage.length > 0) {
    return trimmedCommitMessage
  }
  return `${operation} ${typeName} "${id}"`
}
