import { Entry, GitAdapterError } from '@commitspark/git-adapter'
import { ApolloContext } from '../client'
import { createError } from '../graphql/errors'

type Ref = string
type EntriesCache = Map<Ref, EntriesRecord>
type SchemaCache = Map<Ref, string>
type InflightEntries = Map<Ref, Promise<EntriesRecord>>

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

// intentionally not async so that the same in-flight promise is returned to all callers
const getEntriesRecordByRef = (
  entriesCache: EntriesCache,
  inflightEntries: InflightEntries,
  cacheSize: number,
  context: ApolloContext,
  ref: string,
): Promise<EntriesRecord> => {
  const cacheRecord = entriesCache.get(ref)
  if (cacheRecord !== undefined) {
    // move map key back to end of list (newest)
    entriesCache.delete(ref)
    entriesCache.set(ref, cacheRecord)

    return Promise.resolve(cacheRecord)
  }

  const inflightPromise = inflightEntries.get(ref)
  if (inflightPromise) {
    return inflightPromise
  }

  const fetchPromise = fetchAndCacheEntries(
    entriesCache,
    cacheSize,
    context,
    ref,
  ).finally(() => inflightEntries.delete(ref))

  inflightEntries.set(ref, fetchPromise)

  return fetchPromise
}

const fetchAndCacheEntries = async (
  entriesCache: EntriesCache,
  cacheSize: number,
  context: ApolloContext,
  ref: string,
): Promise<EntriesRecord> => {
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
    const existingEntriesOfType = entriesByType.get(entry.metadata.type) || []
    existingEntriesOfType.push(entry)
    entriesByType.set(entry.metadata.type, existingEntriesOfType)
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
  const inflightEntries: InflightEntries = new Map<
    Ref,
    Promise<EntriesRecord>
  >()
  return {
    getEntriesRecord: (...args) =>
      getEntriesRecordByRef(entriesCache, inflightEntries, cacheSize, ...args),
    getSchema: (...args) =>
      getSchemaStringByRef(schemaCache, cacheSize, ...args),
  }
}
