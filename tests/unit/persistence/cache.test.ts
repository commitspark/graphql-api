import { createCacheHandler } from '../../../src/persistence/cache'
import type { ApolloContext } from '../../../src/client'
import {
  Entry,
  ErrorCode,
  GitAdapter,
  GitAdapterError,
} from '@commitspark/git-adapter'

jest.mock('../../../src/graphql/errors', () => {
  return {
    createError: jest.fn(
      (message: string, code: string, extensions: Record<string, unknown>) => {
        // mark unused parameters as used to satisfy eslint no-unused-vars
        void message
        void code
        void extensions
        return new Error(`wrapped-error`)
      },
    ),
  }
})

const { createError } = jest.requireMock('../../../src/graphql/errors') as {
  createError: jest.Mock
}

// uses serialized entry content as hash, which satisfies the requirement that equal hashes imply equal content
const createContentHash = (entry: Entry): string =>
  JSON.stringify({ metadata: entry.metadata, data: entry.data })

const makeContext = (
  getEntriesImpl: (commitHash: string) => Promise<Entry[]>,
) => {
  // partial mocks
  const gitAdapter = {
    getEntryHashes: jest.fn(async (commitHash: string) =>
      (await getEntriesImpl(commitHash)).map((entry) => ({
        id: entry.id,
        hash: createContentHash(entry),
      })),
    ),
    getEntriesByIds: jest.fn(async (commitHash: string, ids: string[]) =>
      (await getEntriesImpl(commitHash)).filter((entry) =>
        ids.includes(entry.id),
      ),
    ),
  } as unknown as GitAdapter
  const context: ApolloContext = {
    gitAdapter: gitAdapter,
  } as unknown as ApolloContext

  return { context, gitAdapter }
}

const makeContextForSchema = (
  getSchemaImpl: (ref: string) => Promise<string>,
) => {
  // partial mocks
  const gitAdapter = {
    getSchema: jest.fn(getSchemaImpl),
  } as unknown as GitAdapter
  const context: ApolloContext = {
    gitAdapter: gitAdapter,
  } as unknown as ApolloContext

  return { context, gitAdapter }
}

describe('Cache', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches gitAdapter entries only on cache miss', async () => {
    const entries: Entry[] = [
      { id: '1', metadata: { type: 'A' } },
      { id: '2', metadata: { type: 'B' } },
    ]
    const { context, gitAdapter } = makeContext(async () => entries)
    const cache = createCacheHandler()

    const record1 = await cache.getEntriesRecord(context, 'ref-1')
    expect(gitAdapter.getEntryHashes).toHaveBeenCalledTimes(1)
    expect(gitAdapter.getEntryHashes).toHaveBeenLastCalledWith('ref-1')
    expect(gitAdapter.getEntriesByIds).toHaveBeenCalledTimes(1)
    expect(gitAdapter.getEntriesByIds).toHaveBeenLastCalledWith('ref-1', [
      '1',
      '2',
    ])

    const record2 = await cache.getEntriesRecord(context, 'ref-1')
    // still one call each: second is a cache hit
    expect(gitAdapter.getEntryHashes).toHaveBeenCalledTimes(1)
    expect(gitAdapter.getEntriesByIds).toHaveBeenCalledTimes(1)
    // same object identity for Maps confirms cached result
    expect(record2.byId).toBe(record1.byId)
    expect(record2.byType).toBe(record1.byType)
  })

  it('caches entries by ID and by type', async () => {
    const entry1: Entry = { id: 'id-1', metadata: { type: 'A' } }
    const entry2: Entry = { id: 'id-2', metadata: { type: 'A' }, data: {} }
    const entry3: Entry = { id: 'id-3', metadata: { type: 'B' } }
    const { context } = makeContext(async () => [entry1, entry2, entry3])
    const cache = createCacheHandler()

    const record = await cache.getEntriesRecord(context, 'ref-x')

    // byId
    expect(record.byId.get('id-1')).toStrictEqual(entry1)
    expect(record.byId.get('id-2')).toStrictEqual(entry2)
    expect(record.byId.get('id-3')).toStrictEqual(entry3)

    // byType with stable input order
    expect(record.byType.get('A')).toStrictEqual([entry1, entry2])
    expect(record.byType.get('B')).toStrictEqual([entry3])
  })

  it('fetches only entries with content not already cached from other commits', async () => {
    const unchangedEntry: Entry = { id: 'unchanged', metadata: { type: 'A' } }
    const changedEntryBefore: Entry = {
      id: 'changed',
      metadata: { type: 'A' },
      data: { value: 'before' },
    }
    const changedEntryAfter: Entry = {
      id: 'changed',
      metadata: { type: 'A' },
      data: { value: 'after' },
    }
    const addedEntry: Entry = { id: 'added', metadata: { type: 'B' } }
    const entriesByCommit: Record<string, Entry[]> = {
      'commit-1': [unchangedEntry, changedEntryBefore],
      'commit-2': [unchangedEntry, changedEntryAfter, addedEntry],
    }
    const { context, gitAdapter } = makeContext(
      async (commitHash) => entriesByCommit[commitHash],
    )
    const cache = createCacheHandler()

    await cache.getEntriesRecord(context, 'commit-1')
    const record = await cache.getEntriesRecord(context, 'commit-2')

    expect(gitAdapter.getEntriesByIds).toHaveBeenCalledTimes(2)
    expect(gitAdapter.getEntriesByIds).toHaveBeenLastCalledWith('commit-2', [
      'changed',
      'added',
    ])
    expect(record.byId.get('unchanged')).toStrictEqual(unchangedEntry)
    expect(record.byId.get('changed')).toStrictEqual(changedEntryAfter)
    expect(record.byId.get('added')).toStrictEqual(addedEntry)
  })

  it('does not call gitAdapter for content when all content is already cached', async () => {
    const entry: Entry = { id: 'id-1', metadata: { type: 'A' } }
    const { context, gitAdapter } = makeContext(async () => [entry])
    const cache = createCacheHandler()

    await cache.getEntriesRecord(context, 'commit-1')
    const record = await cache.getEntriesRecord(context, 'commit-2')

    expect(gitAdapter.getEntryHashes).toHaveBeenCalledTimes(2)
    expect(gitAdapter.getEntriesByIds).toHaveBeenCalledTimes(1)
    expect(record.byId.get('id-1')).toStrictEqual(entry)
  })

  it('fetches content shared by multiple entries only once and assigns the correct IDs', async () => {
    const entry1: Entry = { id: 'id-1', metadata: { type: 'A' }, data: {} }
    const entry2: Entry = { id: 'id-2', metadata: { type: 'A' }, data: {} }
    const { context, gitAdapter } = makeContext(async () => [entry1, entry2])
    const cache = createCacheHandler()

    const record = await cache.getEntriesRecord(context, 'commit-1')

    expect(gitAdapter.getEntriesByIds).toHaveBeenLastCalledWith('commit-1', [
      'id-1',
    ])
    expect(record.byId.get('id-1')).toStrictEqual(entry1)
    expect(record.byId.get('id-2')).toStrictEqual(entry2)
  })

  it('rejects when gitAdapter does not return a requested entry', async () => {
    const { context, gitAdapter } = makeContext(async () => [
      { id: 'id-1', metadata: { type: 'A' } },
    ])
    ;(gitAdapter.getEntriesByIds as jest.Mock).mockResolvedValueOnce([])
    const cache = createCacheHandler()

    await expect(
      cache.getEntriesRecord(context, 'commit-1'),
    ).rejects.toBeDefined()
    expect(createError).toHaveBeenCalledWith(
      'Git adapter did not return requested entry "id-1".',
      ErrorCode.INTERNAL_ERROR,
      {},
    )
  })

  it('wraps GitAdapterError via createError', async () => {
    const errorCode = ErrorCode.NOT_FOUND
    const error = new GitAdapterError(errorCode, '')
    const { context } = makeContext(async () => {
      throw error
    })
    const cache = createCacheHandler()

    await expect(cache.getEntriesRecord(context, 'ref-err')).rejects.toEqual(
      // our mocked createError returns this wrapped Error instance
      expect.objectContaining({ message: 'wrapped-error' }),
    )

    expect(createError).toHaveBeenCalledTimes(1)
    expect(createError).toHaveBeenCalledWith('', errorCode, {})
  })

  it('evicts using LRU (least recently used) order', async () => {
    const { context, gitAdapter } = makeContext(async () => [])
    const CACHE_SIZE = 5
    const cache = createCacheHandler(CACHE_SIZE)

    // ensure full cache
    for (let i = 0; i < CACHE_SIZE; i++) {
      await cache.getEntriesRecord(context, `r${i}`)
    }

    expect(gitAdapter.getEntryHashes).toHaveBeenCalledTimes(CACHE_SIZE)

    // Access the oldest key (r0) so it should now be the most recently used
    await cache.getEntriesRecord(context, 'r0') // cache hit, no new call
    expect(gitAdapter.getEntryHashes).toHaveBeenCalledTimes(CACHE_SIZE)

    // Add a new key to trigger eviction of the current oldest (r1)
    await cache.getEntriesRecord(context, 'r-new')
    expect(gitAdapter.getEntryHashes).toHaveBeenCalledTimes(CACHE_SIZE + 1)

    // Now, r0 should still be cached, r1 should have been evicted
    await cache.getEntriesRecord(context, 'r0')
    expect(gitAdapter.getEntryHashes).toHaveBeenCalledTimes(CACHE_SIZE + 1)

    // Asking for r1 now should miss and trigger a re-fetch
    await cache.getEntriesRecord(context, 'r1')
    expect(gitAdapter.getEntryHashes).toHaveBeenCalledTimes(CACHE_SIZE + 2)
  })

  it('evicts content no longer referenced by any cached commit', async () => {
    const entriesByCommit: Record<string, Entry[]> = {
      'commit-1': [{ id: 'id-1', metadata: { type: 'A' }, data: { v: 1 } }],
      'commit-2': [{ id: 'id-1', metadata: { type: 'A' }, data: { v: 2 } }],
      'commit-3': [{ id: 'id-1', metadata: { type: 'A' }, data: { v: 3 } }],
      'commit-4': [{ id: 'id-1', metadata: { type: 'A' }, data: { v: 3 } }],
    }
    const { context, gitAdapter } = makeContext(
      async (commitHash) => entriesByCommit[commitHash],
    )
    const cache = createCacheHandler(2)

    await cache.getEntriesRecord(context, 'commit-1')
    await cache.getEntriesRecord(context, 'commit-2')
    // evicts commit-1 and with it the content only referenced by commit-1
    await cache.getEntriesRecord(context, 'commit-3')
    expect(gitAdapter.getEntriesByIds).toHaveBeenCalledTimes(3)

    // content of commit-1 must be fetched again; evicts commit-2
    await cache.getEntriesRecord(context, 'commit-1')
    expect(gitAdapter.getEntriesByIds).toHaveBeenCalledTimes(4)

    // content of commit-3 is still referenced, so only the listing is fetched
    await cache.getEntriesRecord(context, 'commit-4')
    expect(gitAdapter.getEntryHashes).toHaveBeenCalledTimes(5)
    expect(gitAdapter.getEntriesByIds).toHaveBeenCalledTimes(4)
  })

  it('fetches gitAdapter schema only on cache miss', async () => {
    const schema = 'type Query { ok: Boolean! }'
    const { context, gitAdapter } = makeContextForSchema(async () => schema)
    const cache = createCacheHandler()

    const s1 = await cache.getSchema(context, 'ref-1')
    expect(gitAdapter.getSchema).toHaveBeenCalledTimes(1)
    expect(gitAdapter.getSchema).toHaveBeenLastCalledWith('ref-1')
    expect(s1).toBe(schema)

    const s2 = await cache.getSchema(context, 'ref-1')
    // still one call: second is a cache hit
    expect(gitAdapter.getSchema).toHaveBeenCalledTimes(1)
    expect(s2).toBe(schema)
  })

  it('wraps GitAdapterError via createError for schema', async () => {
    const errorCode = ErrorCode.NOT_FOUND
    const error = new GitAdapterError(errorCode, '')
    const { context } = makeContextForSchema(async () => {
      throw error
    })
    const cache = createCacheHandler()

    await expect(cache.getSchema(context, 'ref-err')).rejects.toEqual(
      // our mocked createError returns this wrapped Error instance
      expect.objectContaining({ message: 'wrapped-error' }),
    )

    expect(createError).toHaveBeenCalledTimes(1)
    expect(createError).toHaveBeenCalledWith('', errorCode, {})
  })

  it('evicts schema using LRU (least recently used) order', async () => {
    const { context, gitAdapter } = makeContextForSchema(async () => 's')
    const CACHE_SIZE = 5
    const cache = createCacheHandler(CACHE_SIZE)

    // ensure full cache
    for (let i = 0; i < CACHE_SIZE; i++) {
      await cache.getSchema(context, `r${i}`)
    }

    expect(gitAdapter.getSchema).toHaveBeenCalledTimes(CACHE_SIZE)

    // Access the oldest key (r0) so it should now be the most recently used
    await cache.getSchema(context, 'r0') // cache hit, no new call
    expect(gitAdapter.getSchema).toHaveBeenCalledTimes(CACHE_SIZE)

    // Add a new key to trigger eviction of the current oldest (r1)
    await cache.getSchema(context, 'r-new')
    expect(gitAdapter.getSchema).toHaveBeenCalledTimes(CACHE_SIZE + 1)

    // Now, r0 should still be cached, r1 should have been evicted
    await cache.getSchema(context, 'r0')
    expect(gitAdapter.getSchema).toHaveBeenCalledTimes(CACHE_SIZE + 1)

    // Asking for r1 now should miss and trigger a re-fetch
    await cache.getSchema(context, 'r1')
    expect(gitAdapter.getSchema).toHaveBeenCalledTimes(CACHE_SIZE + 2)
  })

  it('serves the same in-flight promise to concurrent calls from resolvers', async () => {
    let resolveEntries!: (value: Entry[]) => void
    const entriesPromise = new Promise<Entry[]>((resolve) => {
      resolveEntries = resolve
    })

    const { context, gitAdapter } = makeContext(async () => entriesPromise)
    const cache = createCacheHandler()

    const p1 = cache.getEntriesRecord(context, 'ref-concurrent')
    const p2 = cache.getEntriesRecord(context, 'ref-concurrent')

    expect(gitAdapter.getEntryHashes).toHaveBeenCalledTimes(1)
    expect(gitAdapter.getEntryHashes).toHaveBeenLastCalledWith('ref-concurrent')
    expect(p1).toBe(p2)

    const entries: Entry[] = [
      { id: '1', metadata: { type: 'A' } },
      { id: '2', metadata: { type: 'B' } },
    ]
    resolveEntries(entries)

    const [record1, record2] = await Promise.all([p1, p2])
    expect(record2.byId).toBe(record1.byId)
    expect(record2.byType).toBe(record1.byType)

    expect(gitAdapter.getEntryHashes).toHaveBeenCalledTimes(1)
    expect(gitAdapter.getEntriesByIds).toHaveBeenCalledTimes(1)
  })
})
