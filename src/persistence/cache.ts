import { Entry, GitAdapterError } from '@commitspark/git-adapter'
import { ApolloContext } from '../client'
import { createError } from '../graphql/errors'

type Ref = string
type RepositoryCache = Map<Ref, EntriesRecord>

export interface EntriesRecord {
  byId: Map<string, Entry>
  byType: Map<string, Entry[]>
}

export interface RepositoryCacheHandler {
  getEntriesRecord: (
    context: ApolloContext,
    ref: string,
  ) => Promise<EntriesRecord>
}

const MAX_CACHE_ENTRIES = 50

const getEntriesCacheByRef = async (
  repositoryCache: RepositoryCache,
  cacheSize: number,
  context: ApolloContext,
  ref: string,
): Promise<EntriesRecord> => {
  const cacheRecord = repositoryCache.get(ref)
  if (cacheRecord !== undefined) {
    // move map key back to end of list (newest)
    repositoryCache.delete(ref)
    repositoryCache.set(ref, cacheRecord)

    return cacheRecord
  }

  let allEntries: Entry[]
  try {
    allEntries = await context.gitAdapter.getEntries(ref)
  } catch (err) {
    if (err instanceof GitAdapterError) {
      throw createError(err.message, err.code, {})
    }
    throw err
  }
  const entriesById = new Map(allEntries.map((entry) => [entry.id, entry]))
  const entriesByType = new Map<string, Entry[]>()
  for (const entry of allEntries) {
    const arr = entriesByType.get(entry.metadata.type) || []
    arr.push(entry)
    entriesByType.set(entry.metadata.type, arr)
  }

  const newCacheRecord = {
    byType: entriesByType,
    byId: entriesById,
  }

  repositoryCache.set(ref, newCacheRecord)

  if (repositoryCache.size > cacheSize) {
    // get first map key (oldest)
    const oldestKey = repositoryCache.keys().next().value as Ref | undefined
    if (oldestKey !== undefined) {
      repositoryCache.delete(oldestKey)
    }
  }

  return newCacheRecord
}

export const createCacheHandler = (
  cacheSize: number = MAX_CACHE_ENTRIES,
): RepositoryCacheHandler => {
  const repositoryCache: RepositoryCache = new Map<Ref, EntriesRecord>()
  return {
    getEntriesRecord: (...args) =>
      getEntriesCacheByRef(repositoryCache, cacheSize, ...args),
  }
}
