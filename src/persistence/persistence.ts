import { Entry, GitAdapter, GitAdapterError } from '@commitspark/git-adapter'
import { createError, ErrorCode } from '../graphql/errors'

export async function getTypeById(
  gitAdapter: GitAdapter,
  commitHash: string,
  id: string,
): Promise<string> {
  const requestedEntry = await findById(gitAdapter, commitHash, id)
  return requestedEntry.metadata.type
}

export async function findById(
  gitAdapter: GitAdapter,
  commitHash: string,
  id: string,
): Promise<Entry> {
  let allEntries: Entry[]
  try {
    allEntries = await gitAdapter.getEntries(commitHash)
  } catch (err) {
    if (err instanceof GitAdapterError) {
      throw createError(err.message, err.code, {})
    }
    throw err
  }
  const requestedEntry = allEntries.find((entry: Entry) => entry.id === id)
  if (requestedEntry === undefined) {
    throw createError(`No entry with ID "${id}" exists.`, ErrorCode.NOT_FOUND, {
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
  let allEntries: Entry[]
  try {
    allEntries = await gitAdapter.getEntries(commitHash)
  } catch (err) {
    if (err instanceof GitAdapterError) {
      throw createError(err.message, err.code, {})
    }
    throw err
  }

  return allEntries.filter((entry: Entry) => entry.metadata.type === type)
}

export async function findByTypeId(
  gitAdapter: GitAdapter,
  commitHash: string,
  type: string,
  id: string,
): Promise<Entry> {
  let allEntries: Entry[]
  try {
    allEntries = await gitAdapter.getEntries(commitHash)
  } catch (err) {
    if (err instanceof GitAdapterError) {
      throw createError(err.message, err.code, {})
    }
    throw err
  }
  const requestedEntry = allEntries.find(
    (entry: Entry) => entry.id === id && entry.metadata.type === type,
  )
  if (requestedEntry === undefined) {
    throw createError(
      `No entry of type "${type}" with ID "${id}" exists.`,
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
