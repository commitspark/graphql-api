import { Entry, GitAdapter } from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

const schema = `directive @Entry on OBJECT

type Item @Entry {
    id: ID!
}`

describe('Stored entry files that cannot be read', () => {
  const queryEveryItem = async (entries: Entry[]) => {
    const gitAdapter = mock<GitAdapter>()
    gitAdapter.getLatestCommitHash.mockResolvedValue('c1')
    gitAdapter.getSchema.mockResolvedValue(schema)
    mockEntries(gitAdapter, 'c1', entries)
    return (await createClient(gitAdapter)).postGraphQL('main', {
      query: 'query { data: everyItem { id } }',
    })
  }

  it('should report an entry file whose name is no valid entry ID with BAD_REPOSITORY_DATA', async () => {
    const result = await queryEveryItem([
      { id: 'a', metadata: { type: 'Item' }, data: {} },
      { id: 'what?', metadata: { type: 'Item' }, data: {} },
    ])

    expect(result.errors).toMatchObject([
      {
        message: expect.stringContaining(
          'Entry file of entry "what?" has a name that is no valid entry ID',
        ),
        extensions: {
          code: 'BAD_REPOSITORY_DATA',
          commitspark: { fieldValue: 'what?' },
        },
      },
    ])
    expect(result.data).toEqual({ data: null })
  })

  it('should report an entry without type in its metadata with BAD_REPOSITORY_DATA', async () => {
    const result = await queryEveryItem([
      { id: 'a', metadata: {} as Entry['metadata'], data: {} },
    ])

    expect(result.errors).toMatchObject([
      {
        message: 'Entry "a" has no type in its metadata.',
        extensions: {
          code: 'BAD_REPOSITORY_DATA',
          commitspark: { fieldValue: 'a' },
        },
      },
    ])
  })
})
