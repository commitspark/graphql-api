import { Entry } from '@commitspark/git-adapter'
import { createError, ErrorCode } from '../graphql/errors'
import { ApolloContext } from '../client'

export async function getTypeById(
  context: ApolloContext,
  id: string,
): Promise<string> {
  const requestedEntry = await findById(context, id)
  return requestedEntry.metadata.type
}

export async function findById(
  context: ApolloContext,
  id: string,
): Promise<Entry> {
  const entriesRecord = await context.repositoryCache.getEntriesRecord(
    context,
    context.getCurrentHash(),
  )
  const requestedEntry = entriesRecord.byId.get(id)
  if (requestedEntry === undefined) {
    throw createError(`No entry with ID "${id}" exists.`, ErrorCode.NOT_FOUND, {
      argumentName: 'id',
      argumentValue: id,
    })
  }

  return requestedEntry
}

export async function findByType(
  context: ApolloContext,
  type: string,
): Promise<Entry[]> {
  const entriesRecord = await context.repositoryCache.getEntriesRecord(
    context,
    context.getCurrentHash(),
  )
  return entriesRecord.byType.get(type) ?? []
}

export async function findByTypeId(
  context: ApolloContext,
  type: string,
  id: string,
): Promise<Entry> {
  const entryById = await findById(context, id)
  if (entryById === undefined || entryById.metadata.type !== type) {
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

  return entryById
}
