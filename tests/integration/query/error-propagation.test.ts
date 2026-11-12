import { Entry, GitAdapter } from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

// Errors in parts of a result follow GraphQL's null propagation: the failing value becomes null if its type is
// nullable, otherwise the error propagates to the closest nullable parent. These tests check this in interplay with
// GraphQL execution for every kind of position; which violations are found and where they are thrown is covered by the
// unit tests of the entry validator and of the field value resolver.

const gitRef = 'myRef'
const commitHash = 'abcd'

const schema = `directive @Entry on OBJECT

type Person @Entry {
    id: ID!
    name: String!
}

type NullableList @Entry { id: ID!, people: [Person] }
type NonNullElements @Entry { id: ID!, people: [Person!] }
type NonNullList @Entry { id: ID!, people: [Person]! }
type NonNullListAndElements @Entry { id: ID!, people: [Person!]! }
`

// `invalid` cannot be read, as its non-null field `name` is missing
const people = [{ id: 'valid' }, { id: 'invalid' }]
const entries: Entry[] = [
  { id: 'valid', metadata: { type: 'Person' }, data: { name: 'Ada' } },
  { id: 'invalid', metadata: { type: 'Person' }, data: {} },
  { id: 'a', metadata: { type: 'NullableList' }, data: { people } },
  { id: 'b', metadata: { type: 'NonNullElements' }, data: { people } },
  { id: 'c', metadata: { type: 'NonNullList' }, data: { people } },
  { id: 'd', metadata: { type: 'NonNullListAndElements' }, data: { people } },
]

async function query(queryString: string) {
  const gitAdapter = mock<GitAdapter>()
  gitAdapter.getLatestCommitHash
    .calledWith(gitRef)
    .mockResolvedValue(commitHash)
  gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(schema)
  mockEntries(gitAdapter, commitHash, entries)
  const client = await createClient(gitAdapter)
  const result = await client.postGraphQL(gitRef, { query: queryString })
  return {
    data: result.data,
    errorPaths: result.errors?.map((error) => error.path),
  }
}

const ada = { id: 'valid', name: 'Ada' }

describe('Error propagation in lists', () => {
  it.each<[string, string, string, string, unknown]>([
    [
      'only the failing element',
      '[Person]',
      'NullableList',
      'a',
      { id: 'a', people: [ada, null] },
    ],
    [
      'the list',
      '[Person!]',
      'NonNullElements',
      'b',
      { id: 'b', people: null },
    ],
    [
      'only the failing element',
      '[Person]!',
      'NonNullList',
      'c',
      { id: 'c', people: [ada, null] },
    ],
    ['the parent', '[Person!]!', 'NonNullListAndElements', 'd', null],
  ])(
    'should null %s for a failing element of a list of type %s',
    async (_effect, _listType, typeName, id, expectedData) => {
      expect(
        await query(
          `{ data: ${typeName}(id: "${id}") { id people { id name } } }`,
        ),
      ).toEqual({
        data: { data: expectedData },
        errorPaths: [['data', 'people', 1, 'name']],
      })
    },
  )
})

describe('Error propagation in generated fields', () => {
  async function queryWith(entriesOfTest: Entry[], queryString: string) {
    const gitAdapter = mock<GitAdapter>()
    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(schema)
    mockEntries(gitAdapter, commitHash, entriesOfTest)
    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, { query: queryString })
    return {
      data: result.data,
      errorPaths: result.errors?.map((error) => error.path),
      errorCodes: result.errors?.map((error) => error.extensions?.code),
    }
  }

  it('should null only the entries of a list query that cannot be read', async () => {
    const result = await queryWith(
      [
        { id: 'p1', metadata: { type: 'Person' }, data: { name: 'Ada' } },
        { id: 'p2', metadata: { type: 'Person' }, data: {} },
        { id: 'p3', metadata: { type: 'Person' }, data: { name: 'Grace' } },
        { id: 'p4', metadata: { type: 'Person' }, data: { name: 4 } },
      ],
      '{ everyPerson { id name } }',
    )

    expect(result.data).toEqual({
      everyPerson: [
        { id: 'p1', name: 'Ada' },
        null,
        { id: 'p3', name: 'Grace' },
        null,
      ],
    })
    expect(result.errorPaths).toEqual([
      ['everyPerson', 1, 'name'],
      ['everyPerson', 3, 'name'],
    ])
  })

  it('should null only the type name query for an unknown ID', async () => {
    const result = await queryWith(
      [{ id: 'p1', metadata: { type: 'Person' }, data: { name: 'Ada' } }],
      '{ unknown: _typeName(id: "missing") known: _typeName(id: "p1") }',
    )

    expect(result.data).toEqual({ unknown: null, known: 'Person' })
    expect(result.errorPaths).toEqual([['unknown']])
    expect(result.errorCodes).toEqual(['NOT_FOUND'])
  })

  it('should null only the incoming references if they cannot be determined', async () => {
    // the references of an entry of a type unknown to the schema cannot be determined
    const result = await queryWith(
      [
        { id: 'p1', metadata: { type: 'Person' }, data: { name: 'Ada' } },
        { id: 'orphan', metadata: { type: 'RemovedType' }, data: {} },
      ],
      '{ Person(id: "p1") { id name _referencedBy } }',
    )

    expect(result.data).toEqual({
      Person: { id: 'p1', name: 'Ada', _referencedBy: null },
    })
    expect(result.errorPaths).toEqual([['Person', '_referencedBy']])
    expect(result.errorCodes).toEqual(['BAD_REPOSITORY_DATA'])
  })
})

describe('Error propagation for entry data that does not match the schema', () => {
  const articleSchema = `directive @Entry on OBJECT

type Article @Entry {
    id: ID!
    title: String!
    readingTime: Int
    seo: Seo
    tags: [String]
    keywords: [String!]
    block: Block
    author: Author
}

type Seo {
    description: String!
}

type Hero {
    headline: String
}

union Block = Hero

type Author @Entry {
    id: ID!
    name: String
}
`
  const query =
    '{ everyArticle { id title readingTime seo { description } tags keywords block { ... on Hero { headline } } author { id } } }'
  const validArticle = {
    id: 'valid',
    title: 'Valid',
    readingTime: 5,
    seo: { description: 'Text' },
    tags: ['a'],
    keywords: ['b'],
    block: { headline: 'Hello' },
    author: { id: 'ada' },
  }

  async function queryArticles(articles: Entry[], queryString = query) {
    const gitAdapter = mock<GitAdapter>()
    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(articleSchema)
    mockEntries(gitAdapter, commitHash, [
      { id: 'ada', metadata: { type: 'Author' }, data: { name: 'Ada' } },
      ...articles,
    ])
    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, { query: queryString })
    return { data: result.data, errors: result.errors }
  }

  const article = (data: Record<string, unknown>): Entry => ({
    id: 'article',
    metadata: { type: 'Article' },
    data: {
      title: 'Valid',
      readingTime: 5,
      seo: { description: 'Text' },
      tags: ['a'],
      keywords: ['b'],
      block: { Hero: { headline: 'Hello' } },
      author: { id: 'ada' },
      ...data,
    },
  })

  // one case per kind of position within entry data; other kinds of violations are thrown the same way, see the unit
  // tests of the field value resolver
  it.each([
    [
      'a value of the wrong type in a nullable field',
      { readingTime: '5 min' },
      { readingTime: null },
      ['readingTime'],
    ],
    [
      'a missing value of a non-null field in a nullable object',
      { seo: {} },
      { seo: null },
      ['seo', 'description'],
    ],
  ])(
    'should null only the affected value for %s',
    async (_description, invalidData, expectedChange, dataPath) => {
      const result = await queryArticles([article(invalidData)])

      expect(result.data).toEqual({
        everyArticle: [{ ...validArticle, id: 'article', ...expectedChange }],
      })
      expect(result.errors).toHaveLength(1)
      expect(result.errors?.[0]).toMatchObject({
        path: ['everyArticle', 0, ...dataPath],
        extensions: {
          code: 'BAD_REPOSITORY_DATA',
          commitspark: {
            typeName: 'Article',
            fieldValue: 'article',
            violations: [{ path: dataPath }],
          },
        },
      })
    },
  )

  it('should report an inline union member value that is not an object at the union field', async () => {
    const result = await queryArticles([article({ block: { Hero: 'text' } })])

    expect(result.data).toEqual({
      everyArticle: [{ ...validArticle, id: 'article', block: null }],
    })
    expect(result.errors).toHaveLength(1)
    expect(result.errors?.[0]).toMatchObject({
      path: ['everyArticle', 0, 'block'],
      extensions: {
        code: 'BAD_REPOSITORY_DATA',
        commitspark: { violations: [{ path: ['block', 'Hero'] }] },
      },
    })
  })

  it('should null the entry for a missing value of a non-null field', async () => {
    const result = await queryArticles([
      article({ title: undefined }),
      { id: 'valid', metadata: { type: 'Article' }, data: article({}).data },
    ])

    expect(result.data).toEqual({ everyArticle: [null, validArticle] })
    expect(result.errors?.map((error) => error.path)).toEqual([
      ['everyArticle', 0, 'title'],
    ])
  })

  it('should not report data that does not match the schema in fields that are not queried', async () => {
    const result = await queryArticles(
      [article({ readingTime: '5 min', tags: 'a' })],
      '{ everyArticle { id title } }',
    )

    expect(result.data).toEqual({
      everyArticle: [{ id: 'article', title: 'Valid' }],
    })
    expect(result.errors).toBeUndefined()
  })

  it('should report entry data that is not an object at the position of the entry', async () => {
    const result = await queryArticles([
      { id: 'article', metadata: { type: 'Article' }, data: 'text' as never },
    ])

    expect(result.data).toEqual({ everyArticle: [null] })
    expect(result.errors?.map((error) => error.path)).toEqual([
      ['everyArticle', 0],
    ])
  })
})
