import { GitAdapter } from '@commitspark/git-adapter'
import {
  buildSchema,
  GraphQLField,
  GraphQLNamedType,
  GraphQLSchema,
  isInputObjectType,
  isObjectType,
} from 'graphql'
import { mock } from 'jest-mock-extended'
import { createClient } from '../../../src'

const gitRef = 'myRef'
const commitHash = 'abcd'

async function getGeneratedSchema(originalSchema: string) {
  const gitAdapter = mock<GitAdapter>()
  gitAdapter.getLatestCommitHash
    .calledWith(gitRef)
    .mockResolvedValue(commitHash)
  gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(originalSchema)

  const client = await createClient(gitAdapter)
  return client.getSchema(gitRef)
}

async function buildGeneratedSchema(
  originalSchema: string,
): Promise<GraphQLSchema> {
  return buildSchema((await getGeneratedSchema(originalSchema)).data)
}

// maps field names to their type, e.g. `{ id: 'ID!', entryA: 'EntryAIdInput' }`
function fieldTypes(
  type: GraphQLNamedType | null | undefined,
): Record<string, string> {
  if (!isObjectType(type) && !isInputObjectType(type)) {
    throw new Error(`Expected an object or input object type, got "${type}"`)
  }
  return Object.fromEntries(
    Object.values(type.getFields()).map((field) => [
      field.name,
      String(field.type),
    ]),
  )
}

// maps argument names to their type, e.g. `{ id: 'ID!', commit: '_CommitInput' }`
function argumentTypes(
  field: GraphQLField<unknown, unknown> | undefined,
): Record<string, string> {
  if (field === undefined) {
    throw new Error('Expected a field, got undefined')
  }
  return Object.fromEntries(
    field.args.map((argument) => [argument.name, String(argument.type)]),
  )
}

function directiveNames(type: GraphQLNamedType | null | undefined): string[] {
  return (
    type?.astNode?.directives?.map((directive) => directive.name.value) ?? []
  )
}

describe('Schema generator', () => {
  // The order of generated elements is part of the contract because it determines the order of elements in editing
  // forms. This test therefore compares the complete output, including order and descriptions.
  it('should generate the complete schema in a stable order', async () => {
    const originalSchema = `directive @Entry on OBJECT
directive @Ui(visibleList:Boolean) on FIELD_DEFINITION

type MyEntry @Entry {
    id: ID!
    name: String @Ui(visibleList:true)
    nestedType: NestedType
    entryA: EntryA
}

type NestedType {
    title: String
    description: String
}

type EntryA @Entry {
    id: ID!
    name: String
}`

    const result = await getGeneratedSchema(originalSchema)

    const expectedSchema = `directive @Entry on OBJECT

directive @Ui(visibleList: Boolean) on FIELD_DEFINITION

type MyEntry @Entry {
  id: ID!
  name: String @Ui(visibleList: true)
  nestedType: NestedType
  entryA: EntryA
}

type NestedType {
  title: String
  description: String
}

type EntryA @Entry {
  id: ID!
  name: String
}

schema {
  query: Query
  mutation: Mutation
}

type Query {
  everyMyEntry: [MyEntry!]
  everyEntryA: [EntryA!]
  MyEntry(id: ID!): MyEntry
  EntryA(id: ID!): EntryA
  _typeName(id: ID!): String!
}

type Mutation {
  createMyEntry(
    id: ID!
    data: MyEntryInput!
    """
    Details of the commit. If no message is given, the message is 'Create MyEntry "<id>"'.
    """
    commit: _CommitInput
  ): MyEntry
  createEntryA(
    id: ID!
    data: EntryAInput!
    """
    Details of the commit. If no message is given, the message is 'Create EntryA "<id>"'.
    """
    commit: _CommitInput
  ): EntryA
  updateMyEntry(
    id: ID!
    data: MyEntryInput!
    """
    Version of the entry (field \`_version\`) that the change is based on. If given and the entry has a different
    version, the mutation fails with error code CONFLICT instead of overwriting changes made since.
    """
    expectedVersion: String
    """
    Details of the commit. If no message is given, the message is 'Update MyEntry "<id>"'.
    """
    commit: _CommitInput
  ): MyEntry
  updateEntryA(
    id: ID!
    data: EntryAInput!
    """
    Version of the entry (field \`_version\`) that the change is based on. If given and the entry has a different
    version, the mutation fails with error code CONFLICT instead of overwriting changes made since.
    """
    expectedVersion: String
    """
    Details of the commit. If no message is given, the message is 'Update EntryA "<id>"'.
    """
    commit: _CommitInput
  ): EntryA
  deleteMyEntry(
    id: ID!
    """
    Version of the entry (field \`_version\`) that the change is based on. If given and the entry has a different
    version, the mutation fails with error code CONFLICT instead of overwriting changes made since.
    """
    expectedVersion: String
    """
    Details of the commit. If no message is given, the message is 'Delete MyEntry "<id>"'.
    """
    commit: _CommitInput
  ): ID
  deleteEntryA(
    id: ID!
    """
    Version of the entry (field \`_version\`) that the change is based on. If given and the entry has a different
    version, the mutation fails with error code CONFLICT instead of overwriting changes made since.
    """
    expectedVersion: String
    """
    Details of the commit. If no message is given, the message is 'Delete EntryA "<id>"'.
    """
    commit: _CommitInput
  ): ID
}

"""
Details of the commit created by a mutation.
"""
input _CommitInput {
  """
  Commit message summarizing the change in a single line. Leading and trailing whitespace is removed, and messages
  containing line breaks are rejected with error code BAD_USER_INPUT. If omitted or empty, a message is generated.
  """
  message: String
  """
  Optional details of the change, which may span multiple lines. Leading and trailing whitespace is removed.
  """
  body: String
}

input MyEntryIdInput {
  id: ID!
}

input EntryAIdInput {
  id: ID!
}

input MyEntryInput {
  name: String
  nestedType: NestedTypeInput
  entryA: EntryAIdInput
}

input NestedTypeInput {
  title: String
  description: String
}

input EntryAInput {
  name: String
}

extend type MyEntry {
  _referencedBy: [ID!]!
  """
  Version of the entry, which changes whenever the stored entry changes. Pass it as \`expectedVersion\` to update
  and delete mutations to prevent overwriting changes made since the entry was read.
  """
  _version: String!
}

extend type EntryA {
  _referencedBy: [ID!]!
  """
  Version of the entry, which changes whenever the stored entry changes. Pass it as \`expectedVersion\` to update
  and delete mutations to prevent overwriting changes made since the entry was read.
  """
  _version: String!
}
`

    expect(result.data).toBe(expectedSchema)
    expect(result.ref).toBe(commitHash)
  })

  it('should generate queries, mutations and entry fields for every @Entry type', async () => {
    const schema = await buildGeneratedSchema(`directive @Entry on OBJECT

type EntryA @Entry {
    id: ID!
}

type EntryB @Entry {
    id: ID!
}`)

    const queryFields = schema.getQueryType()?.getFields() ?? {}
    const mutationFields = schema.getMutationType()?.getFields() ?? {}

    expect(fieldTypes(schema.getQueryType())._typeName).toBe('String!')
    expect(argumentTypes(queryFields._typeName)).toEqual({ id: 'ID!' })
    expect(fieldTypes(schema.getType('_CommitInput'))).toEqual({
      message: 'String',
      body: 'String',
    })

    for (const typeName of ['EntryA', 'EntryB']) {
      expect(fieldTypes(schema.getQueryType())).toMatchObject({
        [`every${typeName}`]: `[${typeName}!]`,
        [typeName]: typeName,
      })
      expect(argumentTypes(queryFields[`every${typeName}`])).toEqual({})
      expect(argumentTypes(queryFields[typeName])).toEqual({ id: 'ID!' })

      expect(fieldTypes(schema.getMutationType())).toMatchObject({
        [`create${typeName}`]: typeName,
        [`update${typeName}`]: typeName,
        [`delete${typeName}`]: 'ID',
      })
      expect(argumentTypes(mutationFields[`create${typeName}`])).toEqual({
        id: 'ID!',
        data: `${typeName}Input!`,
        commit: '_CommitInput',
      })
      expect(argumentTypes(mutationFields[`update${typeName}`])).toEqual({
        id: 'ID!',
        data: `${typeName}Input!`,
        expectedVersion: 'String',
        commit: '_CommitInput',
      })
      expect(argumentTypes(mutationFields[`delete${typeName}`])).toEqual({
        id: 'ID!',
        expectedVersion: 'String',
        commit: '_CommitInput',
      })

      expect(fieldTypes(schema.getType(typeName))).toEqual({
        id: 'ID!',
        _referencedBy: '[ID!]!',
        _version: 'String!',
      })
      expect(fieldTypes(schema.getType(`${typeName}IdInput`))).toEqual({
        id: 'ID!',
      })
    }
  })

  it('should reference an @Entry type in input types by its ID input type', async () => {
    const schema = await buildGeneratedSchema(`directive @Entry on OBJECT

type EntryA @Entry {
    id: ID!
    name: String
}

type EntryB @Entry {
    id: ID!
    entryA: EntryA
}`)

    expect(fieldTypes(schema.getType('EntryBInput'))).toEqual({
      entryA: 'EntryAIdInput',
    })
    expect(fieldTypes(schema.getType('EntryAIdInput'))).toEqual({ id: 'ID!' })
  })

  it('should reference an @Entry-based union type in input types by its ID input type', async () => {
    const schema = await buildGeneratedSchema(`directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
    union: MyUnion
}

union MyUnion =
    | EntryA
    | EntryB

type EntryA @Entry {
    id: ID!
    field1: String
}

type EntryB @Entry {
    id: ID!
    field2: String
}`)

    expect(fieldTypes(schema.getType('MyEntryInput'))).toEqual({
      union: 'MyUnionIdInput',
    })
    expect(fieldTypes(schema.getType('MyUnionIdInput'))).toEqual({ id: 'ID!' })
    expect(schema.getType('MyUnionInput')).toBeUndefined()
  })

  it('should generate a @oneOf input type for an inline union type', async () => {
    const schema = await buildGeneratedSchema(`directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
    union: MyUnion
}

union MyUnion =
    | TypeA
    | TypeB

type TypeA {
    field1: String
}

type TypeB {
    field2: String
}`)

    expect(fieldTypes(schema.getType('MyEntryInput'))).toEqual({
      union: 'MyUnionInput',
    })
    expect(directiveNames(schema.getType('MyUnionInput'))).toEqual(['oneOf'])
    expect(fieldTypes(schema.getType('MyUnionInput'))).toEqual({
      TypeA: 'TypeAInput',
      TypeB: 'TypeBInput',
    })
    expect(fieldTypes(schema.getType('TypeAInput'))).toEqual({
      field1: 'String',
    })
    expect(fieldTypes(schema.getType('TypeBInput'))).toEqual({
      field2: 'String',
    })
  })

  it('should include ID fields other than the entry ID in generated input types', async () => {
    const schema = await buildGeneratedSchema(`directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
    sku: ID!
    supplier: SupplierRef
}

type SupplierRef {
    id: ID!
    externalId: ID
}`)

    expect(fieldTypes(schema.getType('MyEntryInput'))).toEqual({
      sku: 'ID!',
      supplier: 'SupplierRefInput',
    })
    expect(fieldTypes(schema.getType('SupplierRefInput'))).toEqual({
      id: 'ID!',
      externalId: 'ID',
    })
  })

  it.each([
    ['without field "id"', 'name: String'],
    ['with field "id" of type "String!"', 'id: String!'],
    ['with nullable field "id"', 'id: ID'],
  ])(
    'should reject schema with @Entry type %s',
    async (_description, fieldDefinition) => {
      const originalSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
    ${fieldDefinition}
}`

      await expect(getGeneratedSchema(originalSchema)).rejects.toMatchObject({
        extensions: {
          code: 'BAD_SCHEMA',
          commitspark: {
            argumentValue:
              'Type "MyEntry" must have a field "id" of type "ID!" to use "@Entry" directive.',
          },
        },
      })
    },
  )
})
