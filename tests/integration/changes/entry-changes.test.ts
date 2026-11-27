import {
  Entry,
  ErrorCode,
  GitAdapter,
  GitAdapterError,
} from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

const fromRef = 'release-1'
const fromHash = 'aaaa'
const toRef = 'main'
const toHash = 'bbbb'

function createGitAdapter(fromEntries: Entry[], toEntries: Entry[]) {
  const gitAdapter = mock<GitAdapter>()
  gitAdapter.getLatestCommitHash.calledWith(fromRef).mockResolvedValue(fromHash)
  gitAdapter.getLatestCommitHash.calledWith(toRef).mockResolvedValue(toHash)
  mockEntries(gitAdapter, fromHash, fromEntries)
  mockEntries(gitAdapter, toHash, toEntries)
  return gitAdapter
}

describe('Entry changes', () => {
  it('should list added, modified and deleted entries ordered by entry ID', async () => {
    const gitAdapter = createGitAdapter(
      [
        {
          id: 'books',
          metadata: { type: 'Category' },
          data: { name: 'Books' },
        },
        { id: 'pen', metadata: { type: 'Product' }, data: { name: 'Pen' } },
        { id: 'shirt', metadata: { type: 'Product' }, data: { name: 'Shirt' } },
      ],
      [
        {
          id: 'books',
          metadata: { type: 'Category' },
          data: { name: 'Books' },
        },
        { id: 'cup', metadata: { type: 'Product' }, data: { name: 'Cup' } },
        {
          id: 'shirt',
          metadata: { type: 'Product' },
          data: { name: 'T-Shirt' },
        },
      ],
    )
    const client = await createClient(gitAdapter)

    const result = await client.getEntryChanges(fromRef, toRef)

    expect(result).toStrictEqual({
      from: fromHash,
      to: toHash,
      entries: [
        { id: 'cup', kind: 'ADDED', type: 'Product', previousType: null },
        { id: 'pen', kind: 'DELETED', type: null, previousType: 'Product' },
        {
          id: 'shirt',
          kind: 'MODIFIED',
          type: 'Product',
          previousType: 'Product',
        },
      ],
    })
  })

  it('should report the previous type of an entry whose type changed', async () => {
    const gitAdapter = createGitAdapter(
      [{ id: 'home', metadata: { type: 'Page' }, data: { title: 'Home' } }],
      [
        {
          id: 'home',
          metadata: { type: 'LandingPage' },
          data: { title: 'Home' },
        },
      ],
    )
    const client = await createClient(gitAdapter)

    const result = await client.getEntryChanges(fromRef, toRef)

    expect(result.entries).toStrictEqual([
      {
        id: 'home',
        kind: 'MODIFIED',
        type: 'LandingPage',
        previousType: 'Page',
      },
    ])
  })

  it('should list no changes when comparing a commit with itself', async () => {
    const gitAdapter = createGitAdapter(
      [],
      [{ id: 'pen', metadata: { type: 'Product' }, data: { name: 'Pen' } }],
    )
    const client = await createClient(gitAdapter)

    const result = await client.getEntryChanges(toRef, toRef)

    expect(result).toStrictEqual({ from: toHash, to: toHash, entries: [] })
  })

  it('should fail with NOT_FOUND for an unknown ref', async () => {
    const gitAdapter = createGitAdapter([], [])
    gitAdapter.getLatestCommitHash
      .calledWith('unknown')
      .mockRejectedValue(
        new GitAdapterError(ErrorCode.NOT_FOUND, 'Ref "unknown" not found'),
      )
    const client = await createClient(gitAdapter)

    await expect(
      client.getEntryChanges('unknown', toRef),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } })
  })
})
