import { Entry, GitAdapter } from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

const gitRef = 'myRef'
const commitHash = 'abcd'

const schema = `directive @Entry on OBJECT

type Product @Entry {
    id: ID!
    name: String!
    price: Int
    category: Category
}

type Category @Entry {
    id: ID!
    name: String!
}`

async function createTestClient(originalSchema: string, entries: Entry[]) {
  const gitAdapter = mock<GitAdapter>()
  gitAdapter.getLatestCommitHash
    .calledWith(gitRef)
    .mockResolvedValue(commitHash)
  gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(originalSchema)
  mockEntries(gitAdapter, commitHash, entries)
  return createClient(gitAdapter)
}

describe('Validation', () => {
  it('should report all violations of all entries ordered by entry ID', async () => {
    const client = await createTestClient(schema, [
      {
        id: 'shirt',
        metadata: { type: 'Product' },
        data: { name: 'Shirt', price: 19.99, colour: 'red' },
      },
      { id: 'books', metadata: { type: 'Category' }, data: { name: 'Books' } },
      {
        id: 'apple',
        metadata: { type: 'Product' },
        data: { category: { id: 'books' } },
      },
      {
        id: 'pen',
        metadata: { type: 'Product' },
        data: { name: 'Pen', category: { id: 'apple' } },
      },
      { id: 'old', metadata: { type: 'Article' }, data: {} },
    ])

    const result = await client.validate(gitRef)

    expect(result.ref).toBe(commitHash)
    expect(result.violations).toMatchObject([
      {
        entryId: 'apple',
        severity: 'ERROR',
        code: 'INVALID_VALUE',
        path: ['name'],
      },
      { entryId: 'old', severity: 'ERROR', code: 'UNKNOWN_ENTRY_TYPE' },
      {
        entryId: 'pen',
        severity: 'ERROR',
        code: 'INCOMPATIBLE_REFERENCE',
        path: ['category'],
      },
      {
        entryId: 'shirt',
        severity: 'WARNING',
        code: 'UNKNOWN_FIELD',
        path: ['colour'],
      },
      {
        entryId: 'shirt',
        severity: 'ERROR',
        code: 'INVALID_VALUE',
        path: ['price'],
      },
    ])
  })

  it('should report no violations for a valid repository', async () => {
    const client = await createTestClient(schema, [
      { id: 'books', metadata: { type: 'Category' }, data: { name: 'Books' } },
      {
        id: 'novel',
        metadata: { type: 'Product' },
        data: { name: 'Novel', category: { id: 'books' } },
      },
    ])

    expect((await client.validate(gitRef)).violations).toEqual([])
  })

  it('should report an invalid schema without validating entries', async () => {
    for (const invalidSchema of [
      'type Product {',
      `directive @Entry on OBJECT
type Product @Entry { name: String }`,
    ]) {
      const client = await createTestClient(invalidSchema, [
        { id: 'old', metadata: { type: 'Article' }, data: {} },
      ])

      const result = await client.validate(gitRef)

      expect(result.violations).toMatchObject([
        { severity: 'ERROR', code: 'INVALID_SCHEMA', path: [] },
      ])
      expect(result.violations[0].entryId).toBeUndefined()
    }
  })

  it('should read entries with unknown keys', async () => {
    const client = await createTestClient(schema, [
      {
        id: 'shirt',
        metadata: { type: 'Product' },
        data: { name: 'Shirt', colour: 'red' },
      },
    ])

    const result = await client.postGraphQL(gitRef, {
      query: `{ data: Product(id: "shirt") { id name } }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({ data: { id: 'shirt', name: 'Shirt' } })
  })

  it('should null a reference to an entry of an incompatible type', async () => {
    const client = await createTestClient(schema, [
      { id: 'shirt', metadata: { type: 'Product' }, data: { name: 'Shirt' } },
      {
        id: 'pen',
        metadata: { type: 'Product' },
        data: { name: 'Pen', category: { id: 'shirt' } },
      },
    ])

    const result = await client.postGraphQL(gitRef, {
      query: `{ data: Product(id: "pen") { id category { id name } } }`,
    })

    expect(result.errors).toMatchObject([
      {
        path: ['data', 'category'],
        extensions: {
          code: 'BAD_REPOSITORY_DATA',
          commitspark: {
            fieldValue: 'pen',
            violations: [
              { code: 'INCOMPATIBLE_REFERENCE', path: ['category'] },
            ],
          },
        },
      },
    ])
    expect(result.errors?.[0].message).toBe(
      'Entry "pen" does not match the schema: category: Reference points to entry "shirt" of type ' +
        '"Product", but field permits only type "Category".',
    )
    // only the nullable field holding the reference is nulled
    expect(result.data).toEqual({ data: { id: 'pen', category: null } })
  })

  it('should report data of a referenced entry that does not match the schema at the affected field', async () => {
    const client = await createTestClient(schema, [
      { id: 'books', metadata: { type: 'Category' }, data: {} },
      {
        id: 'novel',
        metadata: { type: 'Product' },
        data: { name: 'Novel', category: { id: 'books' } },
      },
    ])

    const result = await client.postGraphQL(gitRef, {
      query: `{ data: Product(id: "novel") { id category { id name } } }`,
    })

    // the missing value of non-null field `name` nulls the referenced entry, as the reference itself is nullable
    expect(result.errors).toMatchObject([
      {
        path: ['data', 'category', 'name'],
        extensions: {
          code: 'BAD_REPOSITORY_DATA',
          commitspark: { fieldValue: 'books' },
        },
      },
    ])
    expect(result.data).toEqual({ data: { id: 'novel', category: null } })
  })
})
