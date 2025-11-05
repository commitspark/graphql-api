import { GitAdapter } from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { createClient } from '../../../src'

describe('Schema generator', () => {
  it('should extend schema with a CRUD API for an @Entry type', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT
directive @Ui(visibleList:Boolean) on FIELD_DEFINITION

type MyEntry @Entry {
    id: ID!
    name: String @Ui(visibleList:true)
    nestedType: NestedType
}

type NestedType {
    nestedField: String
}`

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)

    const client = await createClient(gitAdapter)
    const result = await client.getSchema(gitRef)

    const expectedSchema = `directive @Entry on OBJECT

directive @Ui(visibleList: Boolean) on FIELD_DEFINITION

type MyEntry @Entry {
  id: ID!
  name: String @Ui(visibleList: true)
  nestedType: NestedType
}

type NestedType {
  nestedField: String
}

schema {
  query: Query
  mutation: Mutation
}

type Query {
  allMyEntrys: [MyEntry!]
  MyEntry(id: ID!): MyEntry
  _typeName(id: ID!): String!
}

type Mutation {
  createMyEntry(id: ID!, data: MyEntryInput!, commitMessage: String): MyEntry
  updateMyEntry(id: ID!, data: MyEntryInput!, commitMessage: String): MyEntry
  deleteMyEntry(id: ID!, commitMessage: String): ID
}

input MyEntryIdInput {
  id: ID!
}

input MyEntryInput {
  name: String
  nestedType: NestedTypeInput
}

input NestedTypeInput {
  nestedField: String
}
`

    expect(result.data).toBe(expectedSchema)
    expect(result.ref).toBe(commitHash)
  })

  it('should extend schema with a CRUD API for two @Entry types with reference', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type EntryA @Entry {
    id: ID!
    name: String
}

type EntryB @Entry {
    id: ID!
    entryA: EntryA
}`

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)

    const client = await createClient(gitAdapter)
    const result = await client.getSchema(gitRef)

    const expectedSchema = `directive @Entry on OBJECT

type EntryA @Entry {
  id: ID!
  name: String
}

type EntryB @Entry {
  id: ID!
  entryA: EntryA
}

schema {
  query: Query
  mutation: Mutation
}

type Query {
  allEntryAs: [EntryA!]
  allEntryBs: [EntryB!]
  EntryA(id: ID!): EntryA
  EntryB(id: ID!): EntryB
  _typeName(id: ID!): String!
}

type Mutation {
  createEntryA(id: ID!, data: EntryAInput!, commitMessage: String): EntryA
  createEntryB(id: ID!, data: EntryBInput!, commitMessage: String): EntryB
  updateEntryA(id: ID!, data: EntryAInput!, commitMessage: String): EntryA
  updateEntryB(id: ID!, data: EntryBInput!, commitMessage: String): EntryB
  deleteEntryA(id: ID!, commitMessage: String): ID
  deleteEntryB(id: ID!, commitMessage: String): ID
}

input EntryAIdInput {
  id: ID!
}

input EntryBIdInput {
  id: ID!
}

input EntryAInput {
  name: String
}

input EntryBInput {
  entryA: EntryAIdInput
}
`

    expect(result.data).toBe(expectedSchema)
    expect(result.ref).toBe(commitHash)
  })

  it('should extend schema with a CRUD API for an @Entry-based union type', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

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
}`

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)

    const client = await createClient(gitAdapter)
    const result = await client.getSchema(gitRef)

    const expectedSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
  id: ID!
  union: MyUnion
}

union MyUnion = EntryA | EntryB

type EntryA @Entry {
  id: ID!
  field1: String
}

type EntryB @Entry {
  id: ID!
  field2: String
}

schema {
  query: Query
  mutation: Mutation
}

type Query {
  allMyEntrys: [MyEntry!]
  allEntryAs: [EntryA!]
  allEntryBs: [EntryB!]
  MyEntry(id: ID!): MyEntry
  EntryA(id: ID!): EntryA
  EntryB(id: ID!): EntryB
  _typeName(id: ID!): String!
}

type Mutation {
  createMyEntry(id: ID!, data: MyEntryInput!, commitMessage: String): MyEntry
  createEntryA(id: ID!, data: EntryAInput!, commitMessage: String): EntryA
  createEntryB(id: ID!, data: EntryBInput!, commitMessage: String): EntryB
  updateMyEntry(id: ID!, data: MyEntryInput!, commitMessage: String): MyEntry
  updateEntryA(id: ID!, data: EntryAInput!, commitMessage: String): EntryA
  updateEntryB(id: ID!, data: EntryBInput!, commitMessage: String): EntryB
  deleteMyEntry(id: ID!, commitMessage: String): ID
  deleteEntryA(id: ID!, commitMessage: String): ID
  deleteEntryB(id: ID!, commitMessage: String): ID
}

input MyEntryIdInput {
  id: ID!
}

input EntryAIdInput {
  id: ID!
}

input EntryBIdInput {
  id: ID!
}

input MyUnionIdInput {
  id: ID!
}

input MyEntryInput {
  union: MyUnionIdInput
}

input EntryAInput {
  field1: String
}

input EntryBInput {
  field2: String
}
`

    expect(result.data).toBe(expectedSchema)
    expect(result.ref).toBe(commitHash)
  })

  it('should create a CRUD API for an inline union type', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

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
}`

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)

    const client = await createClient(gitAdapter)
    const result = await client.getSchema(gitRef)

    const expectedSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
  id: ID!
  union: MyUnion
}

union MyUnion = TypeA | TypeB

type TypeA {
  field1: String
}

type TypeB {
  field2: String
}

schema {
  query: Query
  mutation: Mutation
}

type Query {
  allMyEntrys: [MyEntry!]
  MyEntry(id: ID!): MyEntry
  _typeName(id: ID!): String!
}

type Mutation {
  createMyEntry(id: ID!, data: MyEntryInput!, commitMessage: String): MyEntry
  updateMyEntry(id: ID!, data: MyEntryInput!, commitMessage: String): MyEntry
  deleteMyEntry(id: ID!, commitMessage: String): ID
}

input MyEntryIdInput {
  id: ID!
}

input MyUnionIdInput {
  id: ID!
}

input MyEntryInput {
  union: MyUnionInput
}

input TypeAInput {
  field1: String
}

input TypeBInput {
  field2: String
}

input MyUnionInput @oneOf {
  TypeA: TypeAInput
  TypeB: TypeBInput
}

directive @oneOf on INPUT_OBJECT
`

    expect(result.data).toBe(expectedSchema)
    expect(result.ref).toBe(commitHash)
  })
})
