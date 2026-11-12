import { Entry } from '@commitspark/git-adapter'
import {
  buildSchema,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
} from 'graphql'
import { ApolloContext } from '../../../src/client'
import {
  DataSourceContext,
  getDataSourceContext,
} from '../../../src/graphql/resolvers/entry-data-source'
import { resolveFieldValue } from '../../../src/graphql/resolvers/field-resolvers/field-value-resolver'
import { Violation } from '../../../src/validation/violation'

const schema = buildSchema(`directive @Entry on OBJECT

type Person @Entry { id: ID!, name: String }
type Company @Entry { id: ID!, name: String }
union Contact = Person | Company
type Seo { description: String }
type Hero { headline: String }
union Block = Hero

type Article @Entry {
    id: ID!
    title: String!
    tags: [String]
    groups: [[String]]
    seo: Seo
    block: Block
    author: Person
    contact: Contact
}`)

const fieldType = (fieldName: string): GraphQLOutputType =>
  (schema.getType('Article') as GraphQLObjectType).getFields()[fieldName].type

const entries: Entry[] = [
  { id: 'ada', metadata: { type: 'Person' }, data: { name: 'Ada' } },
  { id: 'acme', metadata: { type: 'Company' }, data: { name: 'Acme' } },
]

const createRequestContext = (): ApolloContext =>
  ({
    dataSourceContexts: new WeakMap(),
    getCurrentHash: () => 'commit',
    repositoryCache: {
      getEntriesRecord: async () => ({
        byId: new Map(entries.map((entry) => [entry.id, entry])),
      }),
    },
  }) as unknown as ApolloContext

const info = { schema } as GraphQLResolveInfo

const violationAt = (path: (string | number)[]): Violation =>
  ({
    severity: 'ERROR',
    code: 'INVALID_VALUE',
    message: 'Invalid value.',
    path,
    entryId: 'article',
  }) as Violation

const articleContext = (errors: Violation[] = []): DataSourceContext => ({
  entryId: 'article',
  entryType: 'Article',
  path: [],
  errors,
})

const resolve = (
  value: unknown,
  fieldName: string,
  sourceContext: DataSourceContext,
  path: (string | number)[],
  context = createRequestContext(),
) =>
  resolveFieldValue(
    value,
    fieldType(fieldName),
    sourceContext,
    path,
    context,
    info,
  )

describe('Field value resolver', () => {
  it('should throw the violations at its own path as BAD_REPOSITORY_DATA', () => {
    const violation = violationAt(['title'])

    expect(() =>
      resolve(undefined, 'title', articleContext([violation]), ['title']),
    ).toThrow(
      expect.objectContaining({
        message:
          'Entry "article" does not match the schema: title: Invalid value.',
        extensions: {
          code: 'BAD_REPOSITORY_DATA',
          commitspark: {
            typeName: 'Article',
            fieldValue: 'article',
            violations: [violation],
          },
        },
      }),
    )
  })

  it('should not throw violations at other paths', () => {
    const sourceContext = articleContext([violationAt(['seo', 'description'])])

    expect(resolve('Text', 'title', sourceContext, ['title'])).toBe('Text')
  })

  it('should return null for missing values and scalar values as they are', () => {
    expect(resolve(undefined, 'tags', articleContext(), ['tags'])).toBeNull()
    expect(resolve(null, 'seo', articleContext(), ['seo'])).toBeNull()
    expect(resolve('Text', 'title', articleContext(), ['title'])).toBe('Text')
  })

  it('should return an error of a single list element as rejected promise of this element', async () => {
    const result = resolve(
      ['a', 4, 'c'],
      'tags',
      articleContext([violationAt(['tags', 1])]),
      ['tags'],
    ) as unknown[]

    expect(result[0]).toBe('a')
    expect(result[2]).toBe('c')
    await expect(result[1]).rejects.toMatchObject({
      extensions: { code: 'BAD_REPOSITORY_DATA' },
    })
  })

  it('should not cause an unhandled rejection for a failing list element that GraphQL does not complete', async () => {
    // GraphQL stops completing a list when an earlier element with a non-null type fails, so later elements may never
    // get a rejection handler from GraphQL
    const unhandledRejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) =>
      unhandledRejections.push(reason)
    process.on('unhandledRejection', onUnhandledRejection)
    try {
      resolve(['a', 4], 'tags', articleContext([violationAt(['tags', 1])]), [
        'tags',
      ])
      await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 10))
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }

    expect(unhandledRejections).toEqual([])
  })

  it('should resolve elements of nested lists separately', async () => {
    const result = resolve(
      [['a', 4]],
      'groups',
      articleContext([violationAt(['groups', 0, 1])]),
      ['groups'],
    ) as unknown[][]

    expect(result[0][0]).toBe('a')
    await expect(result[0][1]).rejects.toMatchObject({
      extensions: { code: 'BAD_REPOSITORY_DATA' },
    })
  })

  it('should resolve an embedded object as a copy that knows its path within the entry', () => {
    const context = createRequestContext()
    const data = { description: 'Text' }

    const source = resolve(data, 'seo', articleContext(), ['seo'], context)

    expect(source).toEqual(data)
    expect(source).not.toBe(data)
    expect(getDataSourceContext(context, source as object).path).toEqual([
      'seo',
    ])
  })

  it('should resolve an inline union value with its member type and path', () => {
    const context = createRequestContext()

    const source = resolve(
      { Hero: { headline: 'Hello' } },
      'block',
      articleContext(),
      ['block'],
      context,
    )

    expect(source).toEqual({ headline: 'Hello', __typename: 'Hero' })
    expect(getDataSourceContext(context, source as object).path).toEqual([
      'block',
      'Hero',
    ])
  })

  it('should throw the violations of an inline union member value as a whole at the union field', () => {
    const violation = violationAt(['block', 'Hero'])

    expect(() =>
      resolve({ Hero: null }, 'block', articleContext([violation]), ['block']),
    ).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({
          code: 'BAD_REPOSITORY_DATA',
          commitspark: expect.objectContaining({ violations: [violation] }),
        }),
      }),
    )
  })

  it.each([
    ['an @Entry type', 'author', 'ada', { name: 'Ada', id: 'ada' }],
    [
      'a union of @Entry types',
      'contact',
      'acme',
      { name: 'Acme', id: 'acme' },
    ],
  ])(
    'should resolve a reference to %s as the referenced entry',
    async (_description, fieldName, id, expectedSource) => {
      const context = createRequestContext()

      const source = await resolve(
        { id },
        fieldName,
        articleContext(),
        [fieldName],
        context,
      )

      expect(source).toEqual(expectedSource)
      expect(getDataSourceContext(context, source as object)).toMatchObject({
        entryId: id,
        path: [],
      })
    },
  )
})
