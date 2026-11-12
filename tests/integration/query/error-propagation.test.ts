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
      errorPaths: [['data', 'people', 1]],
    })
  })

  it('should null the list if an element of a list with non-null elements fails', async () => {
    expect(
      await query(
        '{ data: NonNullElements(id: "b") { id people { id name } } }',
      ),
    ).toEqual({
      data: { data: { id: 'b', people: null } },
      errorPaths: [['data', 'people', 1]],
    })
  })

  it('should null only the failing element of a non-null list with nullable elements', async () => {
    expect(
      await query('{ data: NonNullList(id: "c") { id people { id name } } }'),
    ).toEqual({
      data: { data: { id: 'c', people: [ada, null] } },
      errorPaths: [['data', 'people', 1]],
    })
  })

  it('should null the parent if an element of a non-null list with non-null elements fails', async () => {
    expect(
      await query(
        '{ data: NonNullListAndElements(id: "d") { id people { id name } } }',
      ),
    ).toEqual({
      data: { data: null },
      errorPaths: [['data', 'people', 1]],
    })
  })

  it('should null only the failing element of a nested list', async () => {
    expect(
      await query('{ data: NestedList(id: "e") { id groups { id name } } }'),
    ).toEqual({
      data: { data: { id: 'e', groups: [[ada, null]] } },
      errorPaths: [['data', 'groups', 0, 1]],
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
      errorPaths: [['data', 'contacts', 1]],
    })
  })
})
