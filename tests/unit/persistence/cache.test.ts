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

const makeContext = (getEntriesImpl: (ref: string) => Promise<Entry[]>) => {
  // partial mocks
  const gitAdapter = {
    getEntries: jest.fn(getEntriesImpl),
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
    expect(gitAdapter.getEntries).toHaveBeenCalledTimes(1)
    expect(gitAdapter.getEntries).toHaveBeenLastCalledWith('ref-1')

    const record2 = await cache.getEntriesRecord(context, 'ref-1')
    // still one call: second is a cache hit
    expect(gitAdapter.getEntries).toHaveBeenCalledTimes(1)
    // same object identity for Maps confirms cached result
    expect(record2.byId).toBe(record1.byId)
    expect(record2.byType).toBe(record1.byType)
  })

  it('caches entries by ID and by type', async () => {
    const entry1: Entry = { id: 'id-1', metadata: { type: 'A' } }
    const entry2: Entry = { id: 'id-2', metadata: { type: 'A' } }
    const entry3: Entry = { id: 'id-3', metadata: { type: 'B' } }
    const { context } = makeContext(async () => [entry1, entry2, entry3])
    const cache = createCacheHandler()

    const record = await cache.getEntriesRecord(context, 'ref-x')

    // byId
    expect(record.byId.get('id-1')).toBe(entry1)
    expect(record.byId.get('id-2')).toBe(entry2)
    expect(record.byId.get('id-3')).toBe(entry3)

    // byType with stable input order
    expect(record.byType.get('A')).toEqual([entry1, entry2])
    expect(record.byType.get('B')).toEqual([entry3])
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

    expect(gitAdapter.getEntries).toHaveBeenCalledTimes(CACHE_SIZE)

    // Access the oldest key (r0) so it should now be the most recently used
    await cache.getEntriesRecord(context, 'r0') // cache hit, no new call
    expect(gitAdapter.getEntries).toHaveBeenCalledTimes(CACHE_SIZE)

    // Add a new key to trigger eviction of the current oldest (r1)
    await cache.getEntriesRecord(context, 'r-new')
    expect(gitAdapter.getEntries).toHaveBeenCalledTimes(CACHE_SIZE + 1)

    // Now, r0 should still be cached, r1 should have been evicted
    await cache.getEntriesRecord(context, 'r0')
    expect(gitAdapter.getEntries).toHaveBeenCalledTimes(CACHE_SIZE + 1)

    // Asking for r1 now should miss and trigger a re-fetch
    await cache.getEntriesRecord(context, 'r1')
    expect(gitAdapter.getEntries).toHaveBeenCalledTimes(CACHE_SIZE + 2)
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

    expect(gitAdapter.getEntries).toHaveBeenCalledTimes(1)
    expect(gitAdapter.getEntries).toHaveBeenLastCalledWith('ref-concurrent')
    expect(p1).toBe(p2)

    const entries: Entry[] = [
      { id: '1', metadata: { type: 'A' } },
      { id: '2', metadata: { type: 'B' } },
    ]
    resolveEntries(entries)

    const [record1, record2] = await Promise.all([p1, p2])
    expect(record2.byId).toBe(record1.byId)
    expect(record2.byType).toBe(record1.byType)

    expect(gitAdapter.getEntries).toHaveBeenCalledTimes(1)
  })
})
