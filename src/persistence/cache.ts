import { Entry, GitAdapterError } from '@commitspark/git-adapter'
import { ApolloContext } from '../client'
import { createError } from '../graphql/errors'

type Ref = string
type EntriesCache = Map<Ref, EntriesRecord>
type SchemaCache = Map<Ref, string>

interface EntriesRecord {
  byId: Map<string, Entry>
  byType: Map<string, Entry[]>
}

export interface RepositoryCacheHandler {
  getEntriesRecord: (
    context: ApolloContext,
    ref: string,
  ) => Promise<EntriesRecord>
  getSchema: (context: ApolloContext, ref: string) => Promise<string>
}

const MAX_CACHE_ENTRIES = 50

const getEntriesRecordByRef = async (
  entriesCache: EntriesCache,
  cacheSize: number,
  context: ApolloContext,
  ref: string,
): Promise<EntriesRecord> => {
  const cacheRecord = entriesCache.get(ref)
  if (cacheRecord !== undefined) {
    // move map key back to end of list (newest)
    entriesCache.delete(ref)
    entriesCache.set(ref, cacheRecord)

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

  entriesCache.set(ref, newCacheRecord)

  if (entriesCache.size > cacheSize) {
    // get first map key (oldest)
    const oldestKey = entriesCache.keys().next().value as Ref | undefined
    if (oldestKey !== undefined) {
      entriesCache.delete(oldestKey)
    }
  }

  return newCacheRecord
}

const getSchemaStringByRef = async (
  schemaCache: SchemaCache,
  cacheSize: number,
  context: ApolloContext,
  ref: string,
): Promise<string> => {
  const schemaCacheRecord = schemaCache.get(ref)
  if (schemaCacheRecord !== undefined) {
    // move map key back to end of list (newest)
    schemaCache.delete(ref)
    schemaCache.set(ref, schemaCacheRecord)

    return schemaCacheRecord
  }

  let schemaString
  try {
    schemaString = await context.gitAdapter.getSchema(ref)
  } catch (err) {
    if (err instanceof GitAdapterError) {
      throw createError(err.message, err.code, {})
    }
    throw err
  }

  schemaCache.set(ref, schemaString)

  if (schemaCache.size > cacheSize) {
    // get first map key (oldest)
    const oldestKey = schemaCache.keys().next().value as Ref | undefined
    if (oldestKey !== undefined) {
      schemaCache.delete(oldestKey)
    }
  }

  return schemaString
}

export const createCacheHandler = (
  cacheSize: number = MAX_CACHE_ENTRIES,
): RepositoryCacheHandler => {
  const entriesCache: EntriesCache = new Map<Ref, EntriesRecord>()
  const schemaCache: SchemaCache = new Map<Ref, string>()
  return {
    getEntriesRecord: (...args) =>
      getEntriesRecordByRef(entriesCache, cacheSize, ...args),
    getSchema: (...args) =>
      getSchemaStringByRef(schemaCache, cacheSize, ...args),
  }
}
