import { Entry, GitAdapter } from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { buildSchema, GraphQLSchema } from 'graphql'
import { createClient } from '../../../src'
import { validateEntry } from '../../../src/validation/entry-validator'

const originalSchema = `directive @Entry on OBJECT

type Page @Entry {
    id: ID!
    title: String!
    rating: Int
    tags: [String!]!
    align: Align
    seo: Seo
    author: Person
    related: [Teaser!]
    sections: [Section!]
}

type Person @Entry {
    id: ID!
    name: String
}

type Seo {
    title: String!
}

enum Align {
    LEFT
    RIGHT
}

union Teaser = Page | Person

union Section = Hero | Text

type Hero {
    headline: String!
}

type Text {
    body: String
}`

async function getGeneratedSchema(): Promise<GraphQLSchema> {
  const gitAdapter = mock<GitAdapter>()
  gitAdapter.getLatestCommitHash.mockResolvedValue('abcd')
  gitAdapter.getSchema.mockResolvedValue(originalSchema)
  const client = await createClient(gitAdapter)
  return buildSchema((await client.getSchema('main')).data)
}

const typesById: Record<string, string> = {
  page: 'Page',
  person: 'Person',
}
const getEntryType = (id: string) => typesById[id]

const validPageData = {
  title: 'Title',
  rating: 5,
  tags: ['a'],
  align: 'LEFT',
  seo: { title: 'SEO' },
  author: { id: 'person' },
  related: [{ id: 'page' }, { id: 'person' }],
  sections: [{ Hero: { headline: 'Hello' } }, { Text: { body: null } }],
}

const page = (data: Record<string, unknown>): Entry => ({
  id: 'page',
  metadata: { type: 'Page' },
  data,
})

describe('Entry validator', () => {
  let schema: GraphQLSchema
  beforeAll(async () => {
    schema = await getGeneratedSchema()
  })

  it('should report no violations for valid data', () => {
    expect(validateEntry(schema, page(validPageData), getEntryType)).toEqual([])
  })

  it('should report an entry of a type that is not an @Entry type', () => {
    for (const type of ['Removed', 'Seo']) {
      expect(
        validateEntry(
          schema,
          { id: 'x', metadata: { type }, data: {} },
          getEntryType,
        ),
      ).toMatchObject([
        { severity: 'ERROR', code: 'UNKNOWN_ENTRY_TYPE', entryId: 'x' },
      ])
    }
  })

  it('should report missing non-null values including lists at their field', () => {
    expect(validateEntry(schema, page({}), getEntryType)).toEqual([
      {
        severity: 'ERROR',
        code: 'INVALID_VALUE',
        message: 'Field "title" of required type "String!" was not provided.',
        path: ['title'],
        entryId: 'page',
      },
      {
        severity: 'ERROR',
        code: 'INVALID_VALUE',
        message: 'Field "tags" of required type "[String!]!" was not provided.',
        path: ['tags'],
        entryId: 'page',
      },
    ])
  })

  it('should report null values of non-null fields and list elements', () => {
    const violations = validateEntry(
      schema,
      page({ ...validPageData, title: null, tags: ['a', null] }),
      getEntryType,
    )
    expect(violations).toMatchObject([
      {
        code: 'INVALID_VALUE',
        message: 'Field "title" of required type "String!" must not be null.',
        path: ['title'],
      },
      {
        code: 'INVALID_VALUE',
        message: 'Value of required type "String!" must not be null.',
        path: ['tags', 1],
      },
    ])
  })

  it('should report an entry without data like an entry with empty data', () => {
    expect(
      validateEntry(
        schema,
        { id: 'page', metadata: { type: 'Page' } },
        getEntryType,
      ),
    ).toHaveLength(2)
  })

  it('should report values not matching their field type', () => {
    const violations = validateEntry(
      schema,
      page({
        ...validPageData,
        rating: 'five',
        tags: 'a',
        align: 'CENTER',
        seo: { title: null },
      }),
      getEntryType,
    )
    // unlike GraphQL input coercion, a single value is not accepted for a list, as reading it would fail
    expect(violations.map((violation) => violation.path)).toEqual([
      ['rating'],
      ['tags'],
      ['align'],
      ['seo', 'title'],
    ])
    expect(
      violations.every((violation) => violation.code === 'INVALID_VALUE'),
    ).toBe(true)
  })

  it('should report invalid union values', () => {
    const violations = validateEntry(
      schema,
      page({
        ...validPageData,
        sections: [
          { Banner: { headline: 'x' } },
          { Hero: { headline: 'x' }, Text: { body: 'y' } },
          { Hero: {} },
        ],
      }),
      getEntryType,
    )
    expect(violations.map((violation) => violation.path)).toEqual([
      ['sections', 0],
      ['sections', 1],
      ['sections', 2, 'Hero', 'headline'],
    ])
    expect(
      violations.every((violation) => violation.code === 'INVALID_VALUE'),
    ).toBe(true)
  })

  it('should report dangling and incompatible references', () => {
    const violations = validateEntry(
      schema,
      page({
        ...validPageData,
        author: { id: 'page' },
        related: [{ id: 'missing' }, { id: 'person' }],
      }),
      getEntryType,
    )
    expect(violations).toMatchObject([
      {
        severity: 'ERROR',
        code: 'INCOMPATIBLE_REFERENCE',
        path: ['author'],
      },
      {
        severity: 'ERROR',
        code: 'DANGLING_REFERENCE',
        path: ['related', 0],
      },
    ])
  })

  it('should report invalid reference shapes', () => {
    expect(
      validateEntry(
        schema,
        page({ ...validPageData, author: 'person' }),
        getEntryType,
      ),
    ).toMatchObject([{ code: 'INVALID_VALUE', path: ['author'] }])
  })

  it('should report invalid list elements at their index', () => {
    expect(
      validateEntry(
        schema,
        page({ ...validPageData, tags: ['a', 4, 'c'] }),
        getEntryType,
      ),
    ).toMatchObject([
      {
        code: 'INVALID_VALUE',
        message: 'String cannot represent a non string value: 4',
        path: ['tags', 1],
      },
    ])
  })

  it('should report entry data that is not an object at the entry itself', () => {
    expect(
      validateEntry(
        schema,
        { id: 'page', metadata: { type: 'Page' }, data: 'text' as never },
        getEntryType,
      ),
    ).toMatchObject([
      {
        code: 'INVALID_VALUE',
        message: 'Expected an object of type "Page".',
        path: [],
      },
    ])
  })

  it('should report the invalid value exactly as stored', () => {
    const violations = validateEntry(
      schema,
      page({
        ...validPageData,
        title: { de: 'Titel', en: 'Title' },
        rating: ['five'],
        tags: 'a',
        align: null,
        seo: null,
        author: { id: 'missing', name: 'Copied' },
        related: [{ id: 'page' }, 'person'],
        sections: [{ Hero: 'Hello' }, { Banner: { headline: 'x' } }],
      }),
      getEntryType,
    )

    expect(
      violations
        .filter((violation) => violation.severity === 'ERROR')
        .map(({ path, value }) => ({ path, value })),
    ).toEqual([
      { path: ['title'], value: { de: 'Titel', en: 'Title' } },
      { path: ['rating'], value: ['five'] },
      { path: ['tags'], value: 'a' },
      { path: ['author'], value: { id: 'missing', name: 'Copied' } },
      { path: ['related', 1], value: 'person' },
      { path: ['sections', 0, 'Hero'], value: 'Hello' },
      { path: ['sections', 1], value: { Banner: { headline: 'x' } } },
    ])
  })

  it('should report null stored for a non-null field as value but not a missing value', () => {
    const violations = validateEntry(
      schema,
      page({ ...validPageData, title: null, tags: undefined }),
      getEntryType,
    )

    expect(violations).toHaveLength(2)
    expect(violations[0]).toMatchObject({ path: ['title'], value: null })
    expect(violations[1].path).toEqual(['tags'])
    expect(violations[1]).not.toHaveProperty('value')
  })

  it('should report entry data that is not an object as value', () => {
    expect(
      validateEntry(
        schema,
        { id: 'page', metadata: { type: 'Page' }, data: ['text'] as never },
        getEntryType,
      ),
    ).toMatchObject([{ path: [], value: ['text'] }])
  })

  it('should not report a value for warnings', () => {
    const violations = validateEntry(
      schema,
      page({ ...validPageData, titel: 'Typo' }),
      getEntryType,
    )

    expect(violations).toHaveLength(1)
    expect(violations[0]).not.toHaveProperty('value')
  })

  it('should report unknown keys as warnings only', () => {
    const violations = validateEntry(
      schema,
      page({
        ...validPageData,
        id: 'page',
        titel: 'Typo',
        seo: { title: 'SEO', twitter: '@x' },
        author: { id: 'person', name: 'Copied' },
        sections: [{ Hero: { headline: 'Hello', subline: 'Removed' } }],
      }),
      getEntryType,
    )
    // unknown keys of an object are reported before its fields are validated
    expect(violations.map((violation) => violation.path)).toEqual([
      ['id'],
      ['titel'],
      ['seo', 'twitter'],
      ['author', 'name'],
      ['sections', 0, 'Hero', 'subline'],
    ])
    expect(
      violations.every(
        (violation) =>
          violation.severity === 'WARNING' &&
          violation.code === 'UNKNOWN_FIELD',
      ),
    ).toBe(true)
  })
})
