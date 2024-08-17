import { Entry, GitAdapter } from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { getApiService } from '../../../src'

describe('Query resolvers', () => {
  it('should resolve references to a second @Entry', async () => {
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
    entryAList: [EntryA!]!
}`

    const entryAId = 'A'
    const entryBId = 'B'

    const entries = [
      {
        id: entryAId,
        metadata: {
          type: 'EntryA',
        },
        data: {
          name: 'My name',
        },
      } as Entry,
      {
        id: entryBId,
        metadata: {
          type: 'EntryB',
        },
        data: {
          entryA: {
            id: entryAId,
          },
          entryAList: [
            {
              id: entryAId,
            },
          ],
        },
      } as Entry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `query {
        data: EntryB(id:"${entryBId}") {
          id
          entryA {
            id
            name
          }
          entryAList {
            id
            name
          }
        }
      }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: entryBId,
        entryA: {
          id: entryAId,
          name: 'My name',
        },
        entryAList: [
          {
            id: entryAId,
            name: 'My name',
          },
        ],
      },
    })
    expect(result.ref).toBe(commitHash)
  })

  it('should resolve a non-@Entry-based union', async () => {
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

    const entryId = 'A'
    const field2Value = 'Field2 value'

    const entries = [
      {
        id: entryId,
        metadata: {
          type: 'MyEntry',
        },
        data: {
          union: {
            typeB: {
              field2: field2Value,
            },
          },
        },
      } as Entry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `query {
        data: MyEntry(id:"${entryId}") {
          id
          union {
            __typename
            ... on TypeB {
              field2
            }
          }
        }
      }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: entryId,
        union: {
          __typename: 'TypeB',
          field2: field2Value,
        },
      },
    })
    expect(result.ref).toBe(commitHash)
  })

  it('should resolve an array of non-@Entry-based unions that is null', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
    union: [MyUnion!]
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

    const entryId = 'A'

    const entries = [
      {
        id: entryId,
        metadata: {
          type: 'MyEntry',
        },
        data: {
          union: null,
        },
      } as Entry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `query {
        data: MyEntry(id:"${entryId}") {
          id
          union {
            __typename
          }
        }
      }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: entryId,
        union: null,
      },
    })
    expect(result.ref).toBe(commitHash)
  })

  it('should resolve an empty array of non-@Entry-based unions', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
    union: [MyUnion!]
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

    const entryId = 'A'

    const entries = [
      {
        id: entryId,
        metadata: {
          type: 'MyEntry',
        },
        data: {
          union: [],
        },
      } as Entry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `query {
        data: MyEntry(id:"${entryId}") {
          id
          union {
            __typename
          }
        }
      }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: entryId,
        union: [],
      },
    })
    expect(result.ref).toBe(commitHash)
  })

  it('should resolve @Entry-based unions', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
    union: MyUnion
    nonNullUnion: MyUnion!
    listUnion: [MyUnion]
    listNonNullUnion: [MyUnion!]
    nonNullListUnion: [MyUnion]!
    nonNullListNonNullUnion: [MyUnion!]!
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

    const myEntryId = 'My'
    const entryBId = 'B'
    const field2Value = 'Field2 value'

    const entries = [
      {
        id: myEntryId,
        metadata: {
          type: 'MyEntry',
        },
        data: {
          union: {
            id: entryBId,
          },
          nonNullUnion: {
            id: entryBId,
          },
          listUnion: [
            {
              id: entryBId,
            },
          ],
          listNonNullUnion: [
            {
              id: entryBId,
            },
          ],
          nonNullListUnion: [
            {
              id: entryBId,
            },
          ],
          nonNullListNonNullUnion: [
            {
              id: entryBId,
            },
          ],
        },
      } as Entry,
      {
        id: entryBId,
        metadata: {
          type: 'EntryB',
        },
        data: {
          field2: field2Value,
        },
      } as Entry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `query {
        data: MyEntry(id:"${myEntryId}") {
          id
          union {
            __typename
            ... on EntryB {
              field2
            }
          }
          union {
            __typename
            ... on EntryB {
              field2
            }
          }
          nonNullUnion {
            __typename
            ... on EntryB {
              field2
            }
          }
          listUnion {
            __typename
            ... on EntryB {
              field2
            }
          }
          listNonNullUnion {
            __typename
            ... on EntryB {
              field2
            }
          }
          nonNullListUnion {
            __typename
            ... on EntryB {
              field2
            }
          }
          nonNullListNonNullUnion {
            __typename
            ... on EntryB {
              field2
            }
          }
        }
      }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: myEntryId,
        union: {
          __typename: 'EntryB',
          field2: field2Value,
        },
        nonNullUnion: {
          __typename: 'EntryB',
          field2: field2Value,
        },
        listUnion: [
          {
            __typename: 'EntryB',
            field2: field2Value,
          },
        ],
        listNonNullUnion: [
          {
            __typename: 'EntryB',
            field2: field2Value,
          },
        ],
        nonNullListUnion: [
          {
            __typename: 'EntryB',
            field2: field2Value,
          },
        ],
        nonNullListNonNullUnion: [
          {
            __typename: 'EntryB',
            field2: field2Value,
          },
        ],
      },
    })
    expect(result.ref).toBe(commitHash)
  })

  it('should resolve missing optional data to null', async () => {
    // the behavior asserted here is meant to reduce the need to migrate existing entries after adding
    // new object type fields to a schema; we expect this to be done by resolving missing (undefined)
    // nullable data to null
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
    oldField: String
    newField: String
    newNestedTypeField: NestedType
}

type NestedType {
    myField: String
}`

    const entryId = 'A'

    const entries = [
      {
        id: entryId,
        metadata: {
          type: 'MyEntry',
        },
        data: {
          oldField: 'Old value',
          // we pretend that this entry was committed when only `id` and `oldField` existed in the schema
        },
      } as Entry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `query {
        data: MyEntry(id:"${entryId}") {
          id
          oldField
          newField
          newNestedTypeField {
            myField
          }
        }
      }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: entryId,
        oldField: 'Old value',
        newField: null,
        newNestedTypeField: null,
      },
    })
    expect(result.ref).toBe(commitHash)
  })

  it('should resolve missing array data to a default value', async () => {
    // the behavior asserted here is meant to reduce the need to migrate existing entries after adding
    // new array fields to a schema; we expect this to be done by resolving missing (undefined)
    // array data to an empty array
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
    oldField: String
    newNestedTypeArrayField: [NestedType]
    newNestedTypeNonNullArrayField: [NestedType]!
}

type NestedType {
    myField: String
}`

    const entryId = 'A'

    const entries = [
      {
        id: entryId,
        metadata: {
          type: 'MyEntry',
        },
        data: {
          oldField: 'Old value',
          // we pretend that this entry was committed when only `id` and `oldField` existed in the schema
        },
      } as Entry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `query {
        data: MyEntry(id:"${entryId}") {
          id
          oldField
          newNestedTypeArrayField {
            myField
          }
          newNestedTypeNonNullArrayField {
            myField
          }
        }
      }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: entryId,
        oldField: 'Old value',
        newNestedTypeArrayField: null,
        newNestedTypeNonNullArrayField: [],
      },
    })
    expect(result.ref).toBe(commitHash)
  })

  it('should resolve missing non-null object type data to an error', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
    oldField: String
    newNestedTypeField: NestedType!
}

type NestedType {
    myField: String
}`

    const entryId = 'A'

    const entries = [
      {
        id: entryId,
        metadata: {
          type: 'MyEntry',
        },
        data: {
          oldField: 'Old value',
          // we pretend that this entry was committed when only `id` and `oldField` existed in the schema
        },
      } as Entry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `query {
        data: MyEntry(id:"${entryId}") {
          id
          oldField
          newNestedTypeField {
            myField
          }
        }
      }`,
    })

    expect(result.errors).toHaveLength(1)
    expect(result.data).toEqual({ data: null })
    expect(result.ref).toBe(commitHash)
  })

  it('should resolve missing optional enum data to null', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
    oldField: String
    newEnumField: EnumType
}

enum EnumType {
    A
    B
}`

    const entryId = 'A'

    const entries = [
      {
        id: entryId,
        metadata: {
          type: 'MyEntry',
        },
        data: {
          oldField: 'Old value',
          // we pretend that this entry was committed when only `id` and `oldField` existed in the schema
        },
      } as Entry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `query {
        data: MyEntry(id:"${entryId}") {
          id
          oldField
          newEnumField
        }
      }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: entryId,
        oldField: 'Old value',
        newEnumField: null,
      },
    })
  })

  it('should resolve missing non-null enum data to an error', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
    oldField: String
    newEnumField: EnumType!
}

enum EnumType {
    A
    B
}`

    const entryId = 'A'

    const entries = [
      {
        id: entryId,
        metadata: {
          type: 'MyEntry',
        },
        data: {
          oldField: 'Old value',
          // we pretend that this entry was committed when only `id` and `oldField` existed in the schema
        },
      } as Entry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `query {
        data: MyEntry(id:"${entryId}") {
          id
          oldField
          newEnumField
        }
      }`,
    })

    expect(result.errors).toHaveLength(1)
    expect(result.data).toEqual({ data: null })
    expect(result.ref).toBe(commitHash)
  })

  it('should resolve missing non-null union data to an error', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
    oldField: String
    newUnionField: MyUnion!
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

    const entryId = 'A'

    const entries = [
      {
        id: entryId,
        metadata: {
          type: 'MyEntry',
        },
        data: {
          oldField: 'Old value',
          // we pretend that this entry was committed when only `id` and `oldField` existed in the schema
        },
      } as Entry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `query {
        data: MyEntry(id:"${entryId}") {
          id
          oldField
          newUnionField {
            __typename
          }
        }
      }`,
    })

    expect(result.errors).toHaveLength(1)
    expect(result.data).toEqual({ data: null })
    expect(result.ref).toBe(commitHash)
  })

  it('should return entries that only have an `id` field', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type MyEntry @Entry {
    id: ID!
}`

    const entryId = 'A'

    const entries = [
      {
        id: entryId,
        metadata: {
          type: 'MyEntry',
        },
      } as Entry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `query {
        data: MyEntry(id:"${entryId}") {
          id
        }
      }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: entryId,
      },
    })
    expect(result.ref).toBe(commitHash)
  })
})
