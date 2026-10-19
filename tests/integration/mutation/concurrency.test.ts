import {
  CommitDraft,
  Entry,
  ErrorCode,
  GitAdapter,
  GitAdapterError,
} from '@commitspark/git-adapter'
import { mock, MockProxy } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

describe('Concurrent writes', () => {
  const gitRef = 'myRef'
  const schema = `directive @Entry on OBJECT

type EntryA @Entry {
    id: ID!
    name: String
    other: EntryA
}`

  const entryA: Entry = {
    id: 'A',
    metadata: { type: 'EntryA' },
    data: { name: 'original' },
  }
  const entryAChanged: Entry = {
    id: 'A',
    metadata: { type: 'EntryA' },
    data: { name: 'changed by someone else' },
  }
  const entryB: Entry = {
    id: 'B',
    metadata: { type: 'EntryA' },
    data: { name: 'B' },
  }

  // version as exposed by the API, which is the hash reported by the mocked Git adapter
  const getVersion = (entry: Entry): string =>
    JSON.stringify({ metadata: entry.metadata, data: entry.data })

  const conflictError = () =>
    new GitAdapterError(ErrorCode.CONFLICT, 'Branch has moved')

  let gitAdapter: MockProxy<GitAdapter>

  // mocks consecutive branch heads with the entries of each commit
  const mockHeads = (heads: [string, Entry[]][]): void => {
    for (const [commitHash, entries] of heads) {
      gitAdapter.getLatestCommitHash.mockResolvedValueOnce(commitHash)
      mockEntries(gitAdapter, commitHash, entries)
    }
  }

  const updateName = async (expectedVersion?: string) =>
    (await createClient(gitAdapter)).postGraphQL(gitRef, {
      query: `mutation ($expectedVersion: String) {
        data: updateEntryA(id: "A", data: { name: "new" }, expectedVersion: $expectedVersion) {
          name
          _version
        }
      }`,
      variables: { expectedVersion: expectedVersion },
    })

  beforeEach(() => {
    gitAdapter = mock<GitAdapter>()
    gitAdapter.getSchema.mockResolvedValue(schema)
  })

  it('should expose the entry version', async () => {
    mockHeads([['h1', [entryA]]])

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `query { data: EntryA(id: "A") { _version } }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({ data: { _version: getVersion(entryA) } })
  })

  it('should update an entry when the expected version matches and return the new version', async () => {
    const updatedEntry: Entry = { ...entryA, data: { name: 'new' } }
    mockHeads([['h1', [entryA]]])
    mockEntries(gitAdapter, 'h2', [updatedEntry])
    gitAdapter.createCommit.mockResolvedValue({ commitHash: 'h2' })

    const result = await updateName(getVersion(entryA))

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: { name: 'new', _version: getVersion(updatedEntry) },
    })
    expect(result.ref).toBe('h2')
  })

  it('should fail with CONFLICT without committing when the expected version does not match', async () => {
    mockHeads([['h1', [entryAChanged]]])

    const result = await updateName(getVersion(entryA))

    expect(result.errors).toHaveLength(1)
    expect(result.errors?.[0].extensions).toMatchObject({
      code: 'CONFLICT',
      commitspark: { argumentName: 'expectedVersion' },
    })
    expect(gitAdapter.createCommit).not.toHaveBeenCalled()
  })

  it('should retry against the new branch head when the branch moved due to an unrelated change', async () => {
    const updatedEntry: Entry = { ...entryA, data: { name: 'new' } }
    mockHeads([
      ['h1', [entryA]],
      ['h2', [entryA, entryB]],
    ])
    mockEntries(gitAdapter, 'h3', [updatedEntry, entryB])
    gitAdapter.createCommit.mockImplementation(async (draft: CommitDraft) => {
      if (draft.parentSha === 'h1') {
        throw conflictError()
      }
      return { commitHash: 'h3' }
    })

    const result = await updateName(getVersion(entryA))

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: { name: 'new', _version: getVersion(updatedEntry) },
    })
    expect(result.ref).toBe('h3')
    expect(
      gitAdapter.createCommit.mock.calls.map(([draft]) => draft.parentSha),
    ).toEqual(['h1', 'h2'])
  })

  it('should fail with CONFLICT when the entry was changed by the commit that moved the branch', async () => {
    mockHeads([
      ['h1', [entryA]],
      ['h2', [entryAChanged]],
    ])
    gitAdapter.createCommit.mockRejectedValue(conflictError())

    const result = await updateName(getVersion(entryA))

    expect(result.errors?.[0].extensions).toMatchObject({
      code: 'CONFLICT',
      commitspark: { argumentName: 'expectedVersion' },
    })
    expect(gitAdapter.createCommit).toHaveBeenCalledTimes(1)
  })

  it('should apply the update to the new branch head when no version is expected', async () => {
    mockHeads([
      ['h1', [entryA]],
      ['h2', [entryAChanged]],
    ])
    mockEntries(gitAdapter, 'h3', [{ ...entryA, data: { name: 'new' } }])
    gitAdapter.createCommit
      .mockRejectedValueOnce(conflictError())
      .mockResolvedValueOnce({ commitHash: 'h3' })

    const result = await updateName()

    expect(result.errors).toBeUndefined()
    expect(gitAdapter.createCommit).toHaveBeenCalledTimes(2)
    expect(gitAdapter.createCommit.mock.calls[1][0].parentSha).toBe('h2')
  })

  it('should fail with CONFLICT after three attempts', async () => {
    mockHeads([
      ['h1', [entryA]],
      ['h2', [entryA]],
      ['h3', [entryA]],
    ])
    gitAdapter.createCommit.mockRejectedValue(conflictError())

    const result = await updateName(getVersion(entryA))

    expect(result.errors?.[0].message).toBe('Branch has moved')
    expect(result.errors?.[0].extensions?.code).toBe('CONFLICT')
    expect(gitAdapter.createCommit).toHaveBeenCalledTimes(3)
  })

  it('should not retry on other Git adapter errors and keep their error code', async () => {
    mockHeads([['h1', [entryA]]])
    gitAdapter.createCommit.mockRejectedValue(
      new GitAdapterError(ErrorCode.FORBIDDEN, 'Not allowed'),
    )

    const result = await updateName()

    expect(result.errors?.[0].extensions?.code).toBe('FORBIDDEN')
    expect(gitAdapter.createCommit).toHaveBeenCalledTimes(1)
  })

  it('should re-validate references when retrying, so that no reference to a concurrently deleted entry is created', async () => {
    mockHeads([
      ['h1', [entryA, entryB]],
      ['h2', [entryA]],
    ])
    gitAdapter.createCommit.mockRejectedValue(conflictError())

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation {
        data: updateEntryA(id: "A", data: { other: { id: "B" } }) { id }
      }`,
    })

    expect(result.errors?.[0].extensions?.code).toBe('BAD_USER_INPUT')
    expect(gitAdapter.createCommit).toHaveBeenCalledTimes(1)
  })

  it('should fail when retrying the creation of an entry that was created concurrently', async () => {
    mockHeads([
      ['h1', []],
      ['h2', [entryA]],
    ])
    gitAdapter.createCommit.mockRejectedValue(conflictError())

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation { data: createEntryA(id: "A", data: { name: "new" }) { id } }`,
    })

    expect(result.errors?.[0].extensions?.code).toBe('BAD_USER_INPUT')
    expect(gitAdapter.createCommit).toHaveBeenCalledTimes(1)
  })

  it('should fail with CONFLICT without deleting when the expected version does not match', async () => {
    mockHeads([['h1', [entryAChanged]]])

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($expectedVersion: String) {
        data: deleteEntryA(id: "A", expectedVersion: $expectedVersion)
      }`,
      variables: { expectedVersion: getVersion(entryA) },
    })

    expect(result.errors?.[0].extensions?.code).toBe('CONFLICT')
    expect(gitAdapter.createCommit).not.toHaveBeenCalled()
  })
})
