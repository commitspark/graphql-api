import { Entry, GitAdapter } from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

// Errors in parts of a result follow GraphQL's null propagation: the failing value becomes null if its type is
// nullable, otherwise the error propagates to the closest nullable parent.

const gitRef = 'myRef'
const commitHash = 'abcd'

const schema = `directive @Entry on OBJECT

type Person @Entry {
    id: ID!
    name: String!
}

type Company @Entry {
    id: ID!
    name: String!
}

union Contact = Person | Company

type NullableList @Entry { id: ID!, people: [Person] }
type NonNullElements @Entry { id: ID!, people: [Person!] }
type NonNullList @Entry { id: ID!, people: [Person]! }
type NonNullListAndElements @Entry { id: ID!, people: [Person!]! }
type NestedList @Entry { id: ID!, groups: [[Person]] }
type UnionList @Entry { id: ID!, contacts: [Contact] }
`

// `invalid` cannot be read, as its non-null field `name` is missing
const people = [{ id: 'valid' }, { id: 'invalid' }]
const entries: Entry[] = [
  { id: 'valid', metadata: { type: 'Person' }, data: { name: 'Ada' } },
  { id: 'invalid', metadata: { type: 'Person' }, data: {} },
  { id: 'acme', metadata: { type: 'Company' }, data: { name: 'Acme' } },
  { id: 'a', metadata: { type: 'NullableList' }, data: { people } },
  { id: 'b', metadata: { type: 'NonNullElements' }, data: { people } },
  { id: 'c', metadata: { type: 'NonNullList' }, data: { people } },
  { id: 'd', metadata: { type: 'NonNullListAndElements' }, data: { people } },
  { id: 'e', metadata: { type: 'NestedList' }, data: { groups: [people] } },
  {
    id: 'f',
    metadata: { type: 'UnionList' },
    data: { contacts: [{ id: 'acme' }, { id: 'invalid' }] },
  },
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
  it('should null only the failing element of a list with nullable elements', async () => {
    expect(
      await query('{ data: NullableList(id: "a") { id people { id name } } }'),
    ).toEqual({
      data: { data: { id: 'a', people: [ada, null] } },
      errorPaths: [['data', 'people', 1, 'name']],
    })
  })

  it('should null the list if an element of a list with non-null elements fails', async () => {
    expect(
      await query(
        '{ data: NonNullElements(id: "b") { id people { id name } } }',
      ),
    ).toEqual({
      data: { data: { id: 'b', people: null } },
      errorPaths: [['data', 'people', 1, 'name']],
    })
  })

  it('should null only the failing element of a non-null list with nullable elements', async () => {
    expect(
      await query('{ data: NonNullList(id: "c") { id people { id name } } }'),
    ).toEqual({
      data: { data: { id: 'c', people: [ada, null] } },
      errorPaths: [['data', 'people', 1, 'name']],
    })
  })

  it('should null the parent if an element of a non-null list with non-null elements fails', async () => {
    expect(
      await query(
        '{ data: NonNullListAndElements(id: "d") { id people { id name } } }',
      ),
    ).toEqual({
      data: { data: null },
      errorPaths: [['data', 'people', 1, 'name']],
    })
  })

  it('should null only the failing element of a nested list', async () => {
    expect(
      await query('{ data: NestedList(id: "e") { id groups { id name } } }'),
    ).toEqual({
      data: { data: { id: 'e', groups: [[ada, null]] } },
      errorPaths: [['data', 'groups', 0, 1, 'name']],
    })
  })

  it('should null only the failing element of a list of a union of @Entry types', async () => {
    expect(
      await query(
        '{ data: UnionList(id: "f") { id contacts { ... on Company { id name } ... on Person { id name } } } }',
      ),
    ).toEqual({
      data: {
        data: { id: 'f', contacts: [{ id: 'acme', name: 'Acme' }, null] },
      },
      errorPaths: [['data', 'contacts', 1, 'name']],
    })
  })
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
    [
      'an invalid element of a list with nullable elements',
      { tags: ['a', 4, 'c'] },
      { tags: ['a', null, 'c'] },
      ['tags', 1],
    ],
    [
      'an invalid element of a list with non-null elements',
      { keywords: ['b', 4] },
      { keywords: null },
      ['keywords', 1],
    ],
    [
      'a union value naming a type that is not a member',
      { block: { Banner: { headline: 'Hello' } } },
      { block: null },
      ['block'],
    ],
    [
      'a reference to an entry that does not exist',
      { author: { id: 'missing' } },
      { author: null },
      ['author'],
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
