import { Entry, GitAdapterError } from '@commitspark/git-adapter'
import { ApolloContext } from '../client.ts'
import { createError, ErrorCode } from '../graphql/errors.ts'

type Ref = string
type ContentHash = string
type EntryContent = Omit<Entry, 'id'>
type EntriesCache = Map<Ref, CommitCacheRecord>
// entry content shared across all cached commits, so that unchanged entries are neither fetched nor stored twice
type ContentCache = Map<ContentHash, EntryContent>
type SchemaCache = Map<Ref, string>
type InflightEntries = Map<Ref, Promise<EntriesRecord>>

interface EntriesRecord {
  byId: Map<string, Entry>
  byType: Map<string, Entry[]>
}

interface CommitCacheRecord {
  entriesRecord: EntriesRecord
  contentHashes: ContentHash[]
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
  contentCache: ContentCache,
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

    return Promise.resolve(cacheRecord.entriesRecord)
  }

  const inflightPromise = inflightEntries.get(ref)
  if (inflightPromise) {
    return inflightPromise
  }

  const fetchPromise = fetchAndCacheEntries(
    entriesCache,
    contentCache,
    cacheSize,
    context,
    ref,
  ).finally(() => inflightEntries.delete(ref))

  inflightEntries.set(ref, fetchPromise)

  return fetchPromise
}

const fetchAndCacheEntries = async (
  entriesCache: EntriesCache,
  contentCache: ContentCache,
  cacheSize: number,
  context: ApolloContext,
  ref: string,
): Promise<EntriesRecord> => {
  const entryHashes = await callGitAdapter(() =>
    context.gitAdapter.getEntryHashes(ref),
  )

  // hold on to known content now, as it may be evicted from the content cache while missing content is fetched
  const contentByHash = new Map<ContentHash, EntryContent>()
  const idsToFetchByHash = new Map<ContentHash, string>()
  for (const { id, hash } of entryHashes) {
    const content = contentCache.get(hash)
    if (content !== undefined) {
      contentByHash.set(hash, content)
    } else if (!idsToFetchByHash.has(hash)) {
      // entries with equal hash have equal content, so fetching one of them is sufficient
      idsToFetchByHash.set(hash, id)
    }
  }

  if (idsToFetchByHash.size > 0) {
    const fetchedEntries = await callGitAdapter(() =>
      context.gitAdapter.getEntriesByIds(ref, [...idsToFetchByHash.values()]),
    )
    const fetchedEntriesById = new Map(
      fetchedEntries.map((entry) => [entry.id, entry]),
    )
    for (const [hash, id] of idsToFetchByHash) {
      const fetchedEntry = fetchedEntriesById.get(id)
      if (fetchedEntry === undefined) {
        throw createError(
          `Git adapter did not return requested entry "${id}".`,
          ErrorCode.INTERNAL_ERROR,
          {},
        )
      }
      contentByHash.set(hash, createEntryContent(fetchedEntry))
    }
  }

  const entriesById = new Map<string, Entry>()
  const entriesByType = new Map<string, Entry[]>()
  for (const { id, hash } of entryHashes) {
    const entry: Entry = {
      id: id,
      ...(contentByHash.get(hash) as EntryContent),
    }
    entriesById.set(id, entry)
    const existingEntriesOfType = entriesByType.get(entry.metadata.type) || []
    existingEntriesOfType.push(entry)
    entriesByType.set(entry.metadata.type, existingEntriesOfType)
  }

  const newCacheRecord: CommitCacheRecord = {
    entriesRecord: {
      byType: entriesByType,
      byId: entriesById,
    },
    contentHashes: [...contentByHash.keys()],
  }

  for (const [hash, content] of contentByHash) {
    contentCache.set(hash, content)
  }
  entriesCache.set(ref, newCacheRecord)

  if (entriesCache.size > cacheSize) {
    // get first map key (oldest)
    const oldestKey = entriesCache.keys().next().value as Ref | undefined
    if (oldestKey !== undefined) {
      entriesCache.delete(oldestKey)
      removeUnreferencedContent(entriesCache, contentCache)
    }
  }

  return newCacheRecord.entriesRecord
}

const createEntryContent = (entry: Entry): EntryContent => {
  const content: EntryContent = { metadata: entry.metadata }
  if (entry.data !== undefined) {
    content.data = entry.data
  }
  return content
}

const removeUnreferencedContent = (
  entriesCache: EntriesCache,
  contentCache: ContentCache,
): void => {
  const referencedHashes = new Set<ContentHash>()
  for (const cacheRecord of entriesCache.values()) {
    for (const hash of cacheRecord.contentHashes) {
      referencedHashes.add(hash)
    }
  }
  for (const hash of contentCache.keys()) {
    if (!referencedHashes.has(hash)) {
      contentCache.delete(hash)
    }
  }
}

const callGitAdapter = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation()
  } catch (err) {
    if (err instanceof GitAdapterError) {
      throw createError(err.message, err.code, {})
    }
    const message = err instanceof Error ? err.message : String(err)
    throw createError(message, ErrorCode.INTERNAL_ERROR, {})
  }
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

  const schemaString = await callGitAdapter(() =>
    context.gitAdapter.getSchema(ref),
  )

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
  const entriesCache: EntriesCache = new Map<Ref, CommitCacheRecord>()
  const contentCache: ContentCache = new Map<ContentHash, EntryContent>()
  const schemaCache: SchemaCache = new Map<Ref, string>()
  const inflightEntries: InflightEntries = new Map<
    Ref,
    Promise<EntriesRecord>
  >()
  return {
    getEntriesRecord: (...args) =>
      getEntriesRecordByRef(
        entriesCache,
        contentCache,
        inflightEntries,
        cacheSize,
        ...args,
      ),
    getSchema: (...args) =>
      getSchemaStringByRef(schemaCache, cacheSize, ...args),
  }
}
