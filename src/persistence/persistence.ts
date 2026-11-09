import { Entry } from '@commitspark/git-adapter'
import { createError, ErrorCode } from '../graphql/errors.ts'
import { ApolloContext } from '../client.ts'

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

/**
 * Returns the version of an entry, which is the content hash of the entry reported by the Git adapter. It changes
 * whenever the stored entry changes.
 */
export async function getEntryVersion(
  context: ApolloContext,
  id: string,
): Promise<string> {
  const entriesRecord = await context.repositoryCache.getEntriesRecord(
    context,
    context.getCurrentHash(),
  )
  const version = entriesRecord.hashById.get(id)
  if (version === undefined) {
    throw createError(`No entry with ID "${id}" exists.`, ErrorCode.NOT_FOUND, {
      argumentName: 'id',
      argumentValue: id,
    })
  }

  return version
}

/**
 * Throws `CONFLICT` if an expected version is given and the entry has a different version at the current commit of
 * the request. This lets callers detect that an entry was changed by someone else since they read it, e.g. while a
 * user was editing the entry, instead of overwriting these changes.
 */
export async function assertExpectedVersion(
  context: ApolloContext,
  id: string,
  expectedVersion: string | null | undefined,
): Promise<void> {
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
