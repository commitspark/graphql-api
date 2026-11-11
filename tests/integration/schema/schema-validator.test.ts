import { GitAdapter } from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { createClient } from '../../../src'

const gitRef = 'myRef'
const commitHash = 'abcd'

const entryDirective = 'directive @Entry on OBJECT\n'
const productType = 'type Product @Entry { id: ID!, name: String }\n'

async function createTestClient(originalSchema: string) {
  const gitAdapter = mock<GitAdapter>()
  gitAdapter.getLatestCommitHash
    .calledWith(gitRef)
    .mockResolvedValue(commitHash)
  gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(originalSchema)
  gitAdapter.getEntryHashes.mockResolvedValue([])
  gitAdapter.getEntriesByIds.mockResolvedValue([])
  return createClient(gitAdapter)
}

async function getSchemaViolationMessages(
  originalSchema: string,
): Promise<string[]> {
  const client = await createTestClient(originalSchema)
  const result = await client.validate(gitRef)
  for (const violation of result.violations) {
    expect(violation).toMatchObject({
      severity: 'ERROR',
      code: 'INVALID_SCHEMA',
      path: [],
    })
  }
  return result.violations.map((violation) => violation.message)
}

describe('Schema validator', () => {
  it.each([
    [
      'an interface',
      'interface Named { name: String }\ntype Item implements Named { name: String }',
      'Interface "Named" is not supported; use a union instead.',
    ],
    [
      'an input type',
      'input Filter { name: String }',
      'Input type "Filter" is not supported, as Commitspark generates input types.',
    ],
    [
      'a custom scalar',
      'scalar DateTime\ntype Event { at: DateTime }',
      'Custom scalar "DateTime" is not supported; use one of the built-in scalars "String", "Int", "Float", ' +
        '"Boolean" and "ID".',
    ],
    [
      'a field with arguments',
      'type Text { content(language: String): String }',
      'Field "Text.content" has arguments, which are not supported.',
    ],
    [
      'a schema definition',
      'type Root { name: String }\nschema { query: Root }',
      'Schema definitions ("schema { ... }") are not supported, as Commitspark generates the root types.',
    ],
    [
      'a type extension',
      'extend type Product { description: String }',
      'Type extensions ("extend") of "Product" are not supported; declare the type in a single definition.',
    ],
    [
      'a directive added by a type extension',
      'type Category { id: ID! }\nextend type Category @Entry',
      'Type extensions ("extend") of "Category" are not supported; declare the type in a single definition.',
    ],
  ])(
    'should reject a schema with %s',
    async (_description, definitions, expectedMessage) => {
      const originalSchema = entryDirective + productType + definitions

      expect(await getSchemaViolationMessages(originalSchema)).toEqual([
        expectedMessage,
      ])

      const client = await createTestClient(originalSchema)
      await expect(client.getSchema(gitRef)).rejects.toMatchObject({
        extensions: {
          code: 'BAD_SCHEMA',
          commitspark: { argumentValue: expectedMessage },
        },
      })
    },
  )

  it('should accept custom directives with arguments', async () => {
    const originalSchema =
      entryDirective +
      'directive @Ui(editor: String, visibleList: Boolean) on FIELD_DEFINITION\n' +
      'directive @Ai(instruction: String) on OBJECT | FIELD_DEFINITION\n' +
      'type Article @Entry @Ai(instruction: "Write in a friendly tone") {\n' +
      '  id: ID!\n' +
      '  title: String @Ui(visibleList: true)\n' +
      '  body: String @Ui(editor: "markdown")\n' +
      '}'

    expect(await getSchemaViolationMessages(originalSchema)).toEqual([])
  })

  it.each([
    [
      'a type named like the input type of another type',
      'type ProductInput { name: String }',
      'Type name "ProductInput" is reserved for the input type of type "Product"; rename the type.',
    ],
    [
      'a type named like the reference input type of an @Entry type',
      'type ProductIdInput { name: String }',
      'Type name "ProductIdInput" is reserved for the reference input type of type "Product"; rename the type.',
    ],
    [
      'a type named like the input type of a union',
      'type Hero { title: String }\nunion Block = Hero\ntype BlockInput { name: String }',
      'Type name "BlockInput" is reserved for the input type of union "Block"; rename the type.',
    ],
    [
      'a type named like a root type',
      'type Query { name: String }',
      'Type name "Query" is reserved for a root type; rename the type.',
    ],
    [
      'a type named like a type of Commitspark',
      'type _CommitInput { message: String }',
      'Type name "_CommitInput" is reserved for a type of Commitspark; rename the type.',
    ],
    [
      'types whose generated type names collide',
      'type ProductId { value: String }',
      'Generated type name "ProductIdInput" would be used for the input type of type "ProductId" and for the ' +
        'reference input type of type "Product"; rename one of the types.',
    ],
    [
      '@Entry types whose generated query names collide',
      'type everyProduct @Entry { id: ID! }',
      'Generated query name "everyProduct" would be used for the query of all entries of type "Product" and for ' +
        'the query of a single entry of type "everyProduct"; rename one of the types.',
    ],
    [
      'an @Entry type named like a query of Commitspark',
      'type _search @Entry { id: ID! }',
      'Generated query name "_search" would be used for a query of Commitspark and for the query of a single ' +
        'entry of type "_search"; rename one of the types.',
    ],
    [
      'an @Entry type with a field named like a field added by Commitspark',
      'type Category @Entry { id: ID!, _version: Int }',
      'Field name "Category._version" is reserved for a field that Commitspark adds to every type with "@Entry" ' +
        'directive; rename the field.',
    ],
  ])(
    'should reject a schema with %s',
    async (_description, definitions, expectedMessage) => {
      const originalSchema = entryDirective + productType + definitions

      expect(await getSchemaViolationMessages(originalSchema)).toEqual([
        expectedMessage,
      ])

      const client = await createTestClient(originalSchema)
      await expect(client.getSchema(gitRef)).rejects.toMatchObject({
        extensions: {
          code: 'BAD_SCHEMA',
          commitspark: { argumentValue: expectedMessage },
        },
      })
    },
  )

  it('should accept names that only resemble generated names', async () => {
    // unions of types without @Entry directive have no reference input type, so `BlockIdInput` is free
    const originalSchema =
      entryDirective +
      productType +
      'type Hero { title: String }\n' +
      'union Block = Hero\n' +
      'type BlockIdInput { name: String }\n' +
      'type ProductInputs { name: String }\n' +
      'type Note { _version: Int }'

    expect(await getSchemaViolationMessages(originalSchema)).toEqual([])
  })

  it('should report all problems of a schema', async () => {
    const originalSchema =
      entryDirective +
      'scalar DateTime\n' +
      'type Event @Entry { name: String, at: DateTime }\n' +
      'type Venue @Entry { name: String }\n' +
      'type Text { content(language: String): String }'

    const expectedMessages = [
      'Custom scalar "DateTime" is not supported; use one of the built-in scalars "String", "Int", "Float", ' +
        '"Boolean" and "ID".',
      'Field "Text.content" has arguments, which are not supported.',
      'Type "Event" must have a field "id" of type "ID!" to use "@Entry" directive.',
      'Type "Venue" must have a field "id" of type "ID!" to use "@Entry" directive.',
    ]
    expect(await getSchemaViolationMessages(originalSchema)).toEqual(
      expectedMessages,
    )

    const client = await createTestClient(originalSchema)
    await expect(client.getSchema(gitRef)).rejects.toMatchObject({
      extensions: {
        code: 'BAD_SCHEMA',
        commitspark: { argumentValue: expectedMessages.join('\n') },
      },
    })
  })
})
