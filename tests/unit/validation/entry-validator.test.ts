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

  it('should report missing non-null values including lists', () => {
    const violations = validateEntry(schema, page({}), getEntryType)
    expect(violations).toHaveLength(2)
    expect(violations).toMatchObject([
      { severity: 'ERROR', code: 'INVALID_VALUE', path: [] },
      { severity: 'ERROR', code: 'INVALID_VALUE', path: [] },
    ])
    expect(violations[0].message).toContain('"title"')
    expect(violations[1].message).toContain('"tags"')
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
    expect(violations.map((violation) => violation.path)).toEqual([
      ['rating'],
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
    // a type that is not a union member is reported as unknown field and as missing `@oneOf` value
    expect(violations.map((violation) => violation.path)).toEqual([
      ['sections', 0],
      ['sections', 0],
      ['sections', 1],
      ['sections', 2, 'Hero'],
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
        path: ['author', 'id'],
      },
      {
        severity: 'ERROR',
        code: 'DANGLING_REFERENCE',
        path: ['related', 0, 'id'],
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
    expect(violations.map((violation) => violation.path)).toEqual([
      ['seo', 'twitter'],
      ['author', 'name'],
      ['sections', 0, 'Hero', 'subline'],
      ['id'],
      ['titel'],
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
