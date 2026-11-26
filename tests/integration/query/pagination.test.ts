import { Entry, GitAdapter } from '@commitspark/git-adapter'
import { mock, MockProxy } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

const schema = `directive @Entry on OBJECT

type Item @Entry {
    id: ID!
}

type Other @Entry {
    id: ID!
}`

const item = (id: string): Entry => ({
  id: id,
  metadata: { type: 'Item' },
  data: {},
})

describe('Pagination of "every" queries', () => {
  let gitAdapter: MockProxy<GitAdapter>

  // mocks a branch pointing to the given commit; commit hashes resolve to themselves, as for real Git adapters
  const mockBranch = (branchHead: string): void => {
    gitAdapter.getLatestCommitHash.mockImplementation(async (ref: string) =>
      ref === 'main' ? branchHead : ref,
    )
  }

  const queryIds = async (
    ref: string,
    args: string,
  ): Promise<{ ids: string[] | undefined; ref: string }> => {
    const result = await (
      await createClient(gitAdapter)
    ).postGraphQL(ref, {
      query: `query { data: everyItem${args} { id } }`,
    })
    expect(result.errors).toBeUndefined()
    return {
      ids: (result.data?.data as { id: string }[] | undefined)?.map(
        (entry) => entry.id,
      ),
      ref: result.ref,
    }
  }

  beforeEach(() => {
    gitAdapter = mock<GitAdapter>()
    gitAdapter.getSchema.mockResolvedValue(schema)
  })

  it('should return entries ordered by ID code point, independent of the order of the Git adapter', async () => {
    mockBranch('c1')
    // "\u{1F600}" (U+1F600) sorts after "～" (U+FF5E) by code point, but before it by UTF-16 code unit
    mockEntries(gitAdapter, 'c1', [
      item('b'),
      item('\u{1F600}'),
      { id: 'aa', metadata: { type: 'Other' }, data: {} },
      item('a/b'),
      item('～'),
      item('a-b'),
      item('a'),
      item('B'),
    ])

    const { ids } = await queryIds('main', '')

    expect(ids).toEqual(['B', 'a', 'a-b', 'a/b', 'b', '～', '\u{1F600}'])
  })

  it.each([
    ['the first page', '(first: 2)', ['a', 'b']],
    ['a page after an offset', '(first: 2, offset: 2)', ['c', 'd']],
    ['a partial last page', '(first: 2, offset: 4)', ['e']],
    ['all remaining entries if "first" is omitted', '(offset: 3)', ['d', 'e']],
    ['no entries after the last entry', '(first: 2, offset: 5)', []],
    ['no entries for "first" of zero', '(first: 0)', []],
    [
      'all entries for null arguments',
      '(first: null, offset: null)',
      ['a', 'b', 'c', 'd', 'e'],
    ],
  ])('should return %s', async (_description, args, expectedIds) => {
    mockBranch('c1')
    mockEntries(gitAdapter, 'c1', ['e', 'c', 'a', 'd', 'b'].map(item))

    const { ids } = await queryIds('main', args)

    expect(ids).toEqual(expectedIds)
  })

  it('should return consistent pages when later pages are requested with the commit hash of the first page', async () => {
    mockBranch('c1')
    mockEntries(gitAdapter, 'c1', ['b', 'c', 'd'].map(item))
    // the branch moves on to a commit with an entry sorted before all others
    mockEntries(gitAdapter, 'c2', ['a', 'b', 'c', 'd'].map(item))

    const firstPage = await queryIds('main', '(first: 2)')
    mockBranch('c2')
    const pinnedSecondPage = await queryIds(
      firstPage.ref,
      '(first: 2, offset: 2)',
    )
    const unpinnedSecondPage = await queryIds('main', '(first: 2, offset: 2)')

    expect(firstPage).toEqual({ ids: ['b', 'c'], ref: 'c1' })
    expect(pinnedSecondPage).toEqual({ ids: ['d'], ref: 'c1' })
    // with the branch name, the page reflects the current commit
    expect(unpinnedSecondPage).toEqual({ ids: ['c', 'd'], ref: 'c2' })
  })

  it.each([['first'], ['offset']])(
    'should reject a negative value of argument "%s"',
    async (argumentName) => {
      mockBranch('c1')
      mockEntries(gitAdapter, 'c1', [item('a')])

      const result = await (
        await createClient(gitAdapter)
      ).postGraphQL('main', {
        query: `query { data: everyItem(${argumentName}: -1) { id } }`,
      })

      expect(result.errors).toMatchObject([
        {
          message: `Argument "${argumentName}" must not be negative.`,
          extensions: {
            code: 'BAD_USER_INPUT',
            commitspark: { argumentName: argumentName, argumentValue: -1 },
          },
        },
      ])
      expect(result.data).toEqual({ data: null })
    },
  )
})
