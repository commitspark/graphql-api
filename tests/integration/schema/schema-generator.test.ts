import { GitAdapter } from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { getApiService } from '../../../src'

describe('Schema generator', () => {
  it('should create a CRUD API for an @Entry type', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
    name: String
}`

    gitAdapter.getLatestCommitHash.calledWith(gitRef).mockResolvedValue(commitHash)
    gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(originalSchema)

    const apiService = await getApiService()
    const result = await apiService.getSchema(gitAdapter, gitRef)

    const expectedSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
  id: ID!
  name: String
}

schema {
  query: Query
  mutation: Mutation
}

type Query {
  allMyEntrys: [MyEntry]
  _allMyEntrysMeta: ListMetadata
  MyEntry(id: ID!): MyEntry
  _typeName(id: ID!): String
}

type Mutation {
  createMyEntry(data:MyEntryInput, message:String): MyEntry
  updateMyEntry(id: ID!, data:MyEntryInput, message:String): MyEntry
  deleteMyEntry(id: ID!, message:String): DeletionResult
}

type ListMetadata {
  count: Int!
}

type DeletionResult {
  id: ID
}

input MyEntryIdInput {
  id: ID!
}

input MyEntryInput {
  name: String
}
`

    expect(result.data).toBe(expectedSchema)
    expect(result.ref).toBe(commitHash)
  })

  it('should create a CRUD API for two @Entry types with reference', async () => {
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

    gitAdapter.getLatestCommitHash.calledWith(gitRef).mockResolvedValue(commitHash)
    gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(originalSchema)

    const apiService = await getApiService()
    const result = await apiService.getSchema(gitAdapter, gitRef)

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
  allEntryAs: [EntryA]
  allEntryBs: [EntryB]
  _allEntryAsMeta: ListMetadata
  _allEntryBsMeta: ListMetadata
  EntryA(id: ID!): EntryA
  EntryB(id: ID!): EntryB
  _typeName(id: ID!): String
}

type Mutation {
  createEntryA(data:EntryAInput, message:String): EntryA
  createEntryB(data:EntryBInput, message:String): EntryB
  updateEntryA(id: ID!, data:EntryAInput, message:String): EntryA
  updateEntryB(id: ID!, data:EntryBInput, message:String): EntryB
  deleteEntryA(id: ID!, message:String): DeletionResult
  deleteEntryB(id: ID!, message:String): DeletionResult
}

type ListMetadata {
  count: Int!
}

type DeletionResult {
  id: ID
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

  it('should create a CRUD API for an @Entry-based union type', async () => {
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

    gitAdapter.getLatestCommitHash.calledWith(gitRef).mockResolvedValue(commitHash)
    gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(originalSchema)

    const apiService = await getApiService()
    const result = await apiService.getSchema(gitAdapter, gitRef)

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
  allMyEntrys: [MyEntry]
  allEntryAs: [EntryA]
  allEntryBs: [EntryB]
  _allMyEntrysMeta: ListMetadata
  _allEntryAsMeta: ListMetadata
  _allEntryBsMeta: ListMetadata
  MyEntry(id: ID!): MyEntry
  EntryA(id: ID!): EntryA
  EntryB(id: ID!): EntryB
  _typeName(id: ID!): String
}

type Mutation {
  createMyEntry(data:MyEntryInput, message:String): MyEntry
  createEntryA(data:EntryAInput, message:String): EntryA
  createEntryB(data:EntryBInput, message:String): EntryB
  updateMyEntry(id: ID!, data:MyEntryInput, message:String): MyEntry
  updateEntryA(id: ID!, data:EntryAInput, message:String): EntryA
  updateEntryB(id: ID!, data:EntryBInput, message:String): EntryB
  deleteMyEntry(id: ID!, message:String): DeletionResult
  deleteEntryA(id: ID!, message:String): DeletionResult
  deleteEntryB(id: ID!, message:String): DeletionResult
}

type ListMetadata {
  count: Int!
}

type DeletionResult {
  id: ID
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

    gitAdapter.getLatestCommitHash.calledWith(gitRef).mockResolvedValue(commitHash)
    gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(originalSchema)

    const apiService = await getApiService()
    const result = await apiService.getSchema(gitAdapter, gitRef)

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
  allMyEntrys: [MyEntry]
  _allMyEntrysMeta: ListMetadata
  MyEntry(id: ID!): MyEntry
  _typeName(id: ID!): String
}

type Mutation {
  createMyEntry(data:MyEntryInput, message:String): MyEntry
  updateMyEntry(id: ID!, data:MyEntryInput, message:String): MyEntry
  deleteMyEntry(id: ID!, message:String): DeletionResult
}

type ListMetadata {
  count: Int!
}

type DeletionResult {
  id: ID
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
  typeA: TypeAInput
  typeB: TypeBInput
}

directive @oneOf on INPUT_OBJECT
`

    expect(result.data).toBe(expectedSchema)
    expect(result.ref).toBe(commitHash)
  })
})
