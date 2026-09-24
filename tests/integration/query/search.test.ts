import { Entry, GitAdapter } from '@commitspark/git-adapter'
import {
  ErrorCode as SearchAdapterErrorCode,
  SearchAdapter,
  SearchAdapterError,
  SearchRequest,
} from '@commitspark/search-adapter'
import { mock } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

const gitRef = 'myRef'
const commitHash = 'abcd'
const originalSchema = `directive @Entry on OBJECT
directive @Searchable on OBJECT | FIELD_DEFINITION

type Article @Entry {
    id: ID!
    title: String @Searchable
    url: String
}

type Author @Entry @Searchable {
    id: ID!
    name: String
}`

const entries: Entry[] = [
  {
    id: 'a1',
    metadata: { type: 'Article' },
    data: { title: 'Rocket launch', url: 'https://example.com' },
  },
  { id: 'au1', metadata: { type: 'Author' }, data: { name: 'Jane' } },
]

const searchQuery = `query ($query: String!, $types: [String!], $first: Int) {
  hits: _search(query: $query, types: $types, first: $first) {
    entryId
    entryType
    fieldPath
    score
    snippet
  }
}`

const createGitAdapter = (schema: string = originalSchema) => {
  const gitAdapter = mock<GitAdapter>()
  gitAdapter.getLatestCommitHash
    .calledWith(gitRef)
    .mockResolvedValue(commitHash)
  gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(schema)
  mockEntries(gitAdapter, commitHash, entries)
  return gitAdapter
}

describe('Search query', () => {
  it('should not expose search query without search adapter', async () => {
    const client = await createClient(createGitAdapter())
    const result = await client.getSchema(gitRef)

    expect(result.data).not.toContain('_search')
    expect(result.data).not.toContain('_SearchHit')
  })

  it('should expose search query with search adapter', async () => {
    const client = await createClient(createGitAdapter(), {
      searchAdapter: mock<SearchAdapter>(),
    })
    const result = await client.getSchema(gitRef)

    expect(result.data).toContain(
      '_search(query: String!, types: [String!], first: Int): [_SearchHit!]!',
    )
    expect(result.data).toContain(`type _SearchHit {
  entryId: ID!
  entryType: String!
  fieldPath: String!
  score: Float!
  snippet: String!
}`)
  })

  it('should pass request to search adapter and return hits', async () => {
    const searchAdapter = mock<SearchAdapter>()
    let searchableFieldValues: unknown
    searchAdapter.search.mockImplementation(async (request) => {
      searchableFieldValues = await request.getSearchableFieldValues()
      return [
        {
          entryId: 'a1',
          entryType: 'Article',
          fieldPath: 'title',
          score: 1.5,
          snippet: 'Rocket launch',
        },
      ]
    })
    const client = await createClient(createGitAdapter(), { searchAdapter })

    const result = await client.postGraphQL(gitRef, {
      query: searchQuery,
      variables: { query: 'rocket' },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      hits: [
        {
          entryId: 'a1',
          entryType: 'Article',
          fieldPath: 'title',
          score: 1.5,
          snippet: 'Rocket launch',
        },
      ],
    })
    expect(result.ref).toBe(commitHash)
    expect(searchAdapter.search).toHaveBeenCalledWith(
      expect.objectContaining({
        commitHash: commitHash,
        query: 'rocket',
        entryTypes: undefined,
        limit: 10,
      } satisfies Partial<SearchRequest>),
    )
    expect(searchableFieldValues).toEqual([
      {
        entryId: 'a1',
        entryType: 'Article',
        fieldPath: 'title',
        value: 'Rocket launch',
      },
      { entryId: 'au1', entryType: 'Author', fieldPath: 'name', value: 'Jane' },
    ])
  })

  it('should pass entry type filter and limit to search adapter', async () => {
    const searchAdapter = mock<SearchAdapter>()
    searchAdapter.search.mockResolvedValue([])
    const client = await createClient(createGitAdapter(), { searchAdapter })

    const result = await client.postGraphQL(gitRef, {
      query: searchQuery,
      variables: { query: 'jane', types: ['Author'], first: 5 },
    })

    expect(result.errors).toBeUndefined()
    expect(searchAdapter.search).toHaveBeenCalledWith(
      expect.objectContaining({
        entryTypes: ['Author'],
        limit: 5,
      } satisfies Partial<SearchRequest>),
    )
  })

  it('should truncate hits exceeding the requested limit', async () => {
    const searchAdapter = mock<SearchAdapter>()
    const hit = {
      entryId: 'a1',
      entryType: 'Article',
      fieldPath: 'title',
      score: 1,
      snippet: 'Rocket launch',
    }
    searchAdapter.search.mockResolvedValue([hit, hit, hit])
    const client = await createClient(createGitAdapter(), { searchAdapter })

    const result = await client.postGraphQL(gitRef, {
      query: searchQuery,
      variables: { query: 'rocket', first: 2 },
    })

    expect((result.data as { hits: unknown[] }).hits).toHaveLength(2)
  })

  it('should return no hits without calling search adapter for empty entry type filter', async () => {
    const searchAdapter = mock<SearchAdapter>()
    const client = await createClient(createGitAdapter(), { searchAdapter })

    const result = await client.postGraphQL(gitRef, {
      query: searchQuery,
      variables: { query: 'rocket', types: [] },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({ hits: [] })
    expect(searchAdapter.search).not.toHaveBeenCalled()
  })

  it.each([
    [{ query: ' ' }, 'query'],
    [{ query: 'rocket', first: 0 }, 'first'],
    [{ query: 'rocket', first: 101 }, 'first'],
    [{ query: 'rocket', types: ['Unknown'] }, 'types'],
  ])('should reject invalid arguments %j', async (variables, argumentName) => {
    const searchAdapter = mock<SearchAdapter>()
    const client = await createClient(createGitAdapter(), { searchAdapter })

    const result = await client.postGraphQL(gitRef, {
      query: searchQuery,
      variables: variables,
    })

    expect(result.errors?.[0].extensions?.code).toBe('BAD_USER_INPUT')
    expect(
      (result.errors?.[0].extensions?.commitspark as { argumentName: string })
        .argumentName,
    ).toBe(argumentName)
    expect(searchAdapter.search).not.toHaveBeenCalled()
  })

  it('should expose search adapter errors with their error code', async () => {
    const searchAdapter = mock<SearchAdapter>()
    searchAdapter.search.mockRejectedValue(
      new SearchAdapterError(
        SearchAdapterErrorCode.TOO_MANY_REQUESTS,
        'Rate limit exceeded',
      ),
    )
    const client = await createClient(createGitAdapter(), { searchAdapter })

    const result = await client.postGraphQL(gitRef, {
      query: searchQuery,
      variables: { query: 'rocket' },
    })

    expect(result.errors?.[0].message).toBe('Rate limit exceeded')
    expect(result.errors?.[0].extensions?.code).toBe('TOO_MANY_REQUESTS')
  })

  it('should reject schema with searchable directive on non-String field', async () => {
    const client = await createClient(
      createGitAdapter(`directive @Entry on OBJECT
directive @Searchable on OBJECT | FIELD_DEFINITION

type Article @Entry {
    id: ID!
    views: Int @Searchable
}`),
    )

    await expect(
      client.postGraphQL(gitRef, { query: '{ everyArticle { id } }' }),
    ).rejects.toMatchObject({
      extensions: {
        code: 'BAD_SCHEMA',
        commitspark: {
          argumentValue:
            'Field "Article.views" must be of type "String" or a list of "String" to use "@Searchable" directive.',
        },
      },
    })
  })
})
