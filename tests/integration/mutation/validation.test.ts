import { CommitDraft, Entry, GitAdapter } from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

const gitRef = 'myRef'
const commitHash = 'abcd'
const postCommitHash = 'ef01'

// `rating` was changed from `Float` to `Int` and `colour` was removed after the stored entry was written
const schema = `directive @Entry on OBJECT

type Product @Entry {
    id: ID!
    name: String!
    rating: Int
    related: Product
}`

const storedEntry: Entry = {
  id: 'shirt',
  metadata: { type: 'Product' },
  data: { name: 'Shirt', rating: 4.5, colour: 'red' },
}

function createTestAdapter(entries: Entry[]) {
  const gitAdapter = mock<GitAdapter>()
  gitAdapter.getLatestCommitHash
    .calledWith(gitRef)
    .mockResolvedValue(commitHash)
  gitAdapter.getSchema.mockResolvedValue(schema)
  mockEntries(gitAdapter, commitHash, entries)
  return gitAdapter
}

describe('Validation of mutation results', () => {
  it('should not commit an update whose resulting entry would not match the schema', async () => {
    const gitAdapter = createTestAdapter([storedEntry])
    const client = await createClient(gitAdapter)

    const result = await client.postGraphQL(gitRef, {
      query: `mutation { data: updateProduct(id: "shirt", data: { name: "Shirt XL" }) { id } }`,
    })

    expect(result.errors).toMatchObject([
      {
        extensions: {
          code: 'BAD_USER_INPUT',
          commitspark: {
            fieldValue: 'shirt',
            violations: [
              {
                severity: 'ERROR',
                code: 'INVALID_VALUE',
                entryId: 'shirt',
                path: ['rating'],
                value: 4.5,
              },
            ],
          },
        },
      },
    ])
    expect(result.errors?.[0].message).toBe(
      'Entry "shirt" would not match the schema: rating: Int cannot represent non-integer value: 4.5',
    )
    expect(result.data).toEqual({ data: null })
    expect(gitAdapter.createCommit).not.toHaveBeenCalled()
  })

  it('should commit an update that fixes invalid data and retain unknown keys', async () => {
    const gitAdapter = createTestAdapter([storedEntry])
    const updatedEntry: Entry = {
      ...storedEntry,
      data: { name: 'Shirt XL', rating: 4, colour: 'red' },
    }
    gitAdapter.createCommit.mockResolvedValue({ commitHash: postCommitHash })
    mockEntries(gitAdapter, postCommitHash, [updatedEntry])
    const client = await createClient(gitAdapter)

    const result = await client.postGraphQL(gitRef, {
      query: `mutation { data: updateProduct(id: "shirt", data: { name: "Shirt XL", rating: 4 }) { id name rating } }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: { id: 'shirt', name: 'Shirt XL', rating: 4 },
    })
    const commitDraft = gitAdapter.createCommit.mock.calls[0][0] as CommitDraft
    expect(commitDraft.entries).toEqual([{ ...updatedEntry, deletion: false }])
  })

  it('should commit a new entry that references itself', async () => {
    const gitAdapter = createTestAdapter([])
    const newEntry: Entry = {
      id: 'loop',
      metadata: { type: 'Product' },
      data: { name: 'Loop', related: { id: 'loop' } },
    }
    gitAdapter.createCommit.mockResolvedValue({ commitHash: postCommitHash })
    mockEntries(gitAdapter, postCommitHash, [newEntry])
    const client = await createClient(gitAdapter)

    const result = await client.postGraphQL(gitRef, {
      query: `mutation { data: createProduct(id: "loop", data: { name: "Loop", related: { id: "loop" } }) { id related { id } } }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: { id: 'loop', related: { id: 'loop' } },
    })
  })
})
