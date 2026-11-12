import { Entry, GitAdapter } from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

// the individual checks are covered by the unit tests of the schema validator; these tests only check that invalid
// schemas are reported through the client
const gitRef = 'myRef'
const commitHash = 'abcd'

const invalidSchema =
  'directive @Entry on OBJECT\n' +
  'scalar DateTime\n' +
  'type Event @Entry { name: String, at: DateTime }'
const expectedMessages = [
  'Custom scalar "DateTime" is not supported; use one of the built-in scalars "String", "Int", "Float", ' +
    '"Boolean" and "ID".',
  'Type "Event" must have a field "id" of type "ID!" to use "@Entry" directive.',
]

async function createTestClient(originalSchema: string, entries: Entry[]) {
  const gitAdapter = mock<GitAdapter>()
  gitAdapter.getLatestCommitHash
    .calledWith(gitRef)
    .mockResolvedValue(commitHash)
  gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(originalSchema)
  mockEntries(gitAdapter, commitHash, entries)
  return createClient(gitAdapter)
}

describe('Schema validation through the client', () => {
  it('should report all problems of an invalid schema as violations without validating entries', async () => {
    const client = await createTestClient(invalidSchema, [
      { id: 'old', metadata: { type: 'Article' }, data: {} },
    ])

    const result = await client.validate(gitRef)

    expect(result.violations).toEqual(
      expectedMessages.map((message) => ({
        severity: 'ERROR',
        code: 'INVALID_SCHEMA',
        message,
        path: [],
      })),
    )
  })

  it('should fail requests on an invalid schema with BAD_SCHEMA listing all problems', async () => {
    const client = await createTestClient(invalidSchema, [])

    await expect(
      client.postGraphQL(gitRef, { query: '{ __typename }' }),
    ).rejects.toMatchObject({
      extensions: {
        code: 'BAD_SCHEMA',
        commitspark: { argumentValue: expectedMessages.join('\n') },
      },
    })
    await expect(client.getSchema(gitRef)).rejects.toMatchObject({
      extensions: {
        code: 'BAD_SCHEMA',
        commitspark: { argumentValue: expectedMessages.join('\n') },
      },
    })
  })

  it('should fail requests on a schema that cannot be parsed with BAD_SCHEMA', async () => {
    const client = await createTestClient('type Product {', [])

    await expect(client.getSchema(gitRef)).rejects.toMatchObject({
      extensions: {
        code: 'BAD_SCHEMA',
        commitspark: {
          schema: 'type Product {',
          argumentValue: expect.stringContaining('Syntax Error'),
        },
      },
    })
  })
})
