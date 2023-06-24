import { ContentEntry, GitAdapter } from '@commitspark/git-adapter'
import { mock } from 'jest-mock-extended'
import { getApiService } from '../../../src'

describe('Query resolvers', () => {
  it('should resolve reference to a second @Entry', async () => {
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
      } as ContentEntry,
      {
        id: entryBId,
        metadata: {
          type: 'EntryB',
        },
        data: {
          entryA: {
            id: entryAId,
          },
        },
      } as ContentEntry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getContentEntries
      .calledWith(commitHash)
      .mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `query {
        data: EntryB(id:"${entryBId}") {
          id
          entryA {
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
      } as ContentEntry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getContentEntries
      .calledWith(commitHash)
      .mockResolvedValue(entries)

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

  it('should resolve an @Entry-based union', async () => {
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
        },
      } as ContentEntry,
      {
        id: entryBId,
        metadata: {
          type: 'EntryB',
        },
        data: {
          field2: field2Value,
        },
      } as ContentEntry,
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    gitAdapter.getContentEntries
      .calledWith(commitHash)
      .mockResolvedValue(entries)

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
      },
    })
    expect(result.ref).toBe(commitHash)
  })
})
