import {
  ErrorCode as GitAdapterErrorCode,
  GitAdapter,
  GitAdapterError,
} from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

const gitRef = 'myRef'
const commitHash = 'abcd'

const schema = `directive @Entry on OBJECT

type Person @Entry {
    id: ID!
    name: String
}`

async function createTestClient() {
  const gitAdapter = mock<GitAdapter>()
  gitAdapter.getLatestCommitHash
    .calledWith(gitRef)
    .mockResolvedValue(commitHash)
  gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(schema)
  mockEntries(gitAdapter, commitHash, [
    { id: 'ada', metadata: { type: 'Person' }, data: { name: 'Ada' } },
  ])
  return createClient(gitAdapter)
}

describe('Request errors', () => {
  it.each<[string, Record<string, unknown>]>([
    ['a syntax error', { query: '{ everyPerson { ' }],
    ['a validation error', { query: '{ unknownField }' }],
    ['a missing query', {}],
    ['a query that is null', { query: null }],
    ['an empty query', { query: '' }],
    [
      'an operation that cannot be determined',
      {
        query: 'query A { everyPerson { id } } query B { everyPerson { id } }',
      },
    ],
    [
      'an unknown operation name',
      { query: 'query A { everyPerson { id } }', operationName: 'B' },
    ],
    [
      'a missing variable value',
      { query: 'query ($id: ID!) { Person(id: $id) { id } }', variables: {} },
    ],
    [
      'an invalid variable value',
      {
        query: 'query ($id: ID!) { Person(id: $id) { id } }',
        variables: { id: { nested: true } },
      },
    ],
    ['a subscription', { query: 'subscription { everyPerson { id } }' }],
  ])(
    'should report %s with code BAD_GRAPHQL_REQUEST and without data',
    async (_description, request) => {
      const client = await createTestClient()

      const result = await client.postGraphQL(gitRef, request as never)

      expect(result.data).toBeUndefined()
      expect(result.errors?.length).toBeGreaterThan(0)
      expect(
        result.errors?.every(
          (error) => error.extensions?.code === 'BAD_GRAPHQL_REQUEST',
        ),
      ).toBe(true)
    },
  )
})

describe('Behavior independent of the environment', () => {
  const originalNodeEnv = process.env.NODE_ENV
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it.each(['production', 'development', undefined])(
    'should allow introspection with NODE_ENV %s',
    async (nodeEnv) => {
      process.env.NODE_ENV = nodeEnv
      const client = await createTestClient()

      const result = await client.postGraphQL(gitRef, {
        query: '{ __schema { queryType { name } } }',
      })

      expect(result).toEqual({
        ref: commitHash,
        data: { __schema: { queryType: { name: 'Query' } } },
        errors: undefined,
      })
    },
  )

  it.each(['production', 'development', undefined])(
    'should not include stack traces in errors with NODE_ENV %s',
    async (nodeEnv) => {
      process.env.NODE_ENV = nodeEnv
      const client = await createTestClient()

      const result = await client.postGraphQL(gitRef, {
        query: '{ Person(id: "missing") { id } }',
      })

      expect(result.errors).toEqual([
        {
          message: 'No entry with ID "missing" exists.',
          locations: [{ line: 1, column: 3 }],
          path: ['Person'],
          extensions: {
            code: 'NOT_FOUND',
            commitspark: { argumentName: 'id', argumentValue: 'missing' },
          },
        },
      ])
    },
  )
})

describe('Request parameters', () => {
  it('should treat null as operation name and variables like omitted values', async () => {
    const client = await createTestClient()

    const result = await client.postGraphQL(gitRef, {
      query: '{ Person(id: "ada") { name } }',
      operationName: null,
      variables: null,
    })

    expect(result.data).toEqual({ Person: { name: 'Ada' } })
    expect(result.errors).toBeUndefined()
  })
})

describe('Errors before execution', () => {
  it.each<[string, unknown, string]>([
    [
      'with the code of a Git adapter error',
      new GitAdapterError(GitAdapterErrorCode.NOT_FOUND, 'Unknown branch.'),
      'NOT_FOUND',
    ],
    [
      'with INTERNAL_ERROR for another error',
      new Error('Failure.'),
      'INTERNAL_ERROR',
    ],
  ])(
    'should throw a failure to resolve the ref %s',
    async (_description, adapterError, expectedCode) => {
      const gitAdapter = mock<GitAdapter>()
      gitAdapter.getLatestCommitHash.mockRejectedValue(adapterError)
      const client = await createClient(gitAdapter)

      for (const call of [
        () => client.postGraphQL(gitRef, { query: '{ everyPerson { id } }' }),
        () => client.getSchema(gitRef),
        () => client.validate(gitRef),
      ]) {
        await expect(call()).rejects.toMatchObject({
          extensions: { code: expectedCode },
        })
      }
    },
  )
})
