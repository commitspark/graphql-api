import { Entry, GitAdapter } from '@commitspark/git-adapter'
import { createError, ErrorCode } from '../graphql/errors'

export async function getTypeById(
  gitAdapter: GitAdapter,
  commitHash: string,
  id: string,
): Promise<string> {
  const allEntries = await gitAdapter.getEntries(commitHash)
  const requestedEntry = allEntries.find((entry: Entry) => entry.id === id)
  if (requestedEntry === undefined) {
    throw createError(`No entry with id "${id}" exists.`, ErrorCode.NOT_FOUND, {
      argumentName: 'id',
      argumentValue: id,
    })
  }

  return requestedEntry.metadata.type
}

export async function findById(
  gitAdapter: GitAdapter,
  commitHash: string,
  id: string,
): Promise<Entry> {
  const allEntries = await gitAdapter.getEntries(commitHash)
  const requestedEntry = allEntries.find((entry: Entry) => entry.id === id)
  if (requestedEntry === undefined) {
    throw createError(`No entry with id "${id}" exists.`, ErrorCode.NOT_FOUND, {
      argumentName: 'id',
      argumentValue: id,
    })
  }

  return requestedEntry
}

export async function findByType(
  gitAdapter: GitAdapter,
  commitHash: string,
  type: string,
): Promise<Entry[]> {
  const allEntries = await gitAdapter.getEntries(commitHash)
  return allEntries.filter((entry: Entry) => entry.metadata.type === type)
}

export async function findByTypeId(
  gitAdapter: GitAdapter,
  commitHash: string,
  type: string,
  id: string,
): Promise<Entry> {
  const allEntries = await gitAdapter.getEntries(commitHash)
  const requestedEntry = allEntries.find(
    (entry: Entry) => entry.id === id && entry.metadata.type === type,
  )
  if (requestedEntry === undefined) {
    throw createError(
      `No entry of type "${type}" with id "${id}" exists.`,
      ErrorCode.NOT_FOUND,
      {
        typeName: type,
        argumentName: 'id',
        argumentValue: id,
      },
    )
  }

  return requestedEntry
}
