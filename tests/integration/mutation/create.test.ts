import {
  Commit,
  CommitDraft,
  Entry,
  GitAdapter,
} from '@commitspark/git-adapter'
import { Matcher, mock } from 'jest-mock-extended'
import { createClient } from '../../../src/index.ts'

describe('"Create" mutation resolvers', () => {
  it('should create an entry', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const schema = `directive @Entry on OBJECT

type EntryA @Entry {
    id: ID!
    name: String
}`

    const commitMessage = 'My message'
    const entryAId = 'd92f77d2-be9b-429f-877d-5c400ea9ce78'
    const postCommitHash = 'ef01'

    const mutationData = {
      name: 'My name',
    }
    const commitResult: Commit = {
      ref: postCommitHash,
    }
    const newEntry: Entry = {
      id: entryAId,
      metadata: {
        type: 'EntryA',
        referencedBy: [],
      },
      data: {
        name: mutationData.name,
      },
    }

    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      entries: [{ ...newEntry, deletion: false }],
      message: commitMessage,
    }

    const commitDraftMatcher = new Matcher<CommitDraft>((actualValue) => {
      return JSON.stringify(actualValue) === JSON.stringify(commitDraft)
    }, '')

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(schema)
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue([])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    gitAdapter.getEntries
      .calledWith(postCommitHash)
      .mockResolvedValue([newEntry])

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $mutationData: EntryAInput!, $commitMessage: String!) {
        data: createEntryA(id: $id, data: $mutationData, commitMessage: $commitMessage) {
          id
        }
      }`,
      variables: {
        id: entryAId,
        mutationData: mutationData,
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: entryAId,
      },
    })
    expect(result.ref).toBe(postCommitHash)
  })

  it('should create an entry that references other entries', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const schema = `directive @Entry on OBJECT

type EntryA @Entry {
    id: ID!
    optionalReference: OptionalReference1
    nonNullReference: NonNullReference!
    arrayReference: [ArrayReference!]!
    unionReference: UnionReference!
    unionNestedReference: UnionNestedReference!
    circularReferenceEntryReference: CircularReferenceEntry
}

type OptionalReference1 {
    nestedReference: OptionalReference2!
}

type OptionalReference2 @Entry {
    id: ID!
}

type NonNullReference @Entry {
    id: ID!
}

type ArrayReference @Entry {
    id: ID!
}

union UnionReference = 
    | UnionEntryType1
    | UnionEntryType2

type UnionEntryType1 @Entry {
    id: ID!
}

type UnionEntryType2 @Entry {
    id: ID!
}

union UnionNestedReference = 
    | UnionType1
    | UnionType2

type UnionType1 {
    otherField: String
}

type UnionType2 {
    nestedReference: UnionNestedEntry
}

type UnionNestedEntry @Entry {
    id: ID!
}

type CircularReferenceEntry @Entry {
    id: ID!
    next: CircularReferenceEntry
}`

    const commitMessage = 'My message'
    const entryAId = 'A'
    const optionalReference2EntryId = 'optionalReference2EntryId'
    const nonNullReferenceEntryId = 'nonNullReferenceEntryId'
    const arrayReferenceEntry1Id = 'arrayReferenceEntry1Id'
    const arrayReferenceEntry2Id = 'arrayReferenceEntry2Id'
    const unionEntryType1Id = 'unionEntryType1Id'
    const unionEntryType2Id = 'unionEntryType2Id'
    const unionNestedEntryId = 'unionNestedEntryId'
    const circularReferenceEntry1Id = 'circularReferenceEntry1Id'
    const circularReferenceEntry2Id = 'circularReferenceEntry2Id'
    const postCommitHash = 'ef01'

    const mutationData = {
      optionalReference: {
        nestedReference: { id: optionalReference2EntryId },
      },
      nonNullReference: { id: nonNullReferenceEntryId },
      arrayReference: [
        { id: arrayReferenceEntry1Id },
        { id: arrayReferenceEntry2Id },
      ],
      unionReference: {
        id: unionEntryType2Id,
      },
      unionNestedReference: {
        UnionType2: {
          nestedReference: {
            id: unionNestedEntryId,
          },
        },
      },
      circularReferenceEntryReference: {
        id: circularReferenceEntry1Id,
      },
    }

    const commitResult: Commit = {
      ref: postCommitHash,
    }

    const existingCircularReference2Entry = {
      id: circularReferenceEntry2Id,
      metadata: {
        type: 'CircularReferenceEntry',
        referencedBy: [circularReferenceEntry1Id],
      },
    }

    const existingEntries: Entry[] = [
      {
        id: optionalReference2EntryId,
        metadata: { type: 'OptionalReference2' },
      },
      { id: nonNullReferenceEntryId, metadata: { type: 'NonNullReference' } },
      { id: arrayReferenceEntry1Id, metadata: { type: 'ArrayReference' } },
      { id: arrayReferenceEntry2Id, metadata: { type: 'ArrayReference' } },
      { id: unionEntryType1Id, metadata: { type: 'UnionEntryType1' } },
      { id: unionEntryType2Id, metadata: { type: 'UnionEntryType2' } },
      { id: unionNestedEntryId, metadata: { type: 'UnionNestedEntry' } },
      {
        id: circularReferenceEntry1Id,
        metadata: {
          type: 'CircularReferenceEntry',
          referencedBy: [circularReferenceEntry2Id],
        },
      },
      existingCircularReference2Entry,
    ]
    const newEntryA: Entry = {
      id: entryAId,
      metadata: {
        type: 'EntryA',
        referencedBy: [],
      },
      data: mutationData,
    }
    const updatedOptionalReference2: Entry = {
      id: optionalReference2EntryId,
      metadata: {
        type: 'OptionalReference2',
        referencedBy: [entryAId],
      },
    }
    const updatedNonNullReference: Entry = {
      id: nonNullReferenceEntryId,
      metadata: {
        type: 'NonNullReference',
        referencedBy: [entryAId],
      },
    }
    const updatedArrayReference1: Entry = {
      id: arrayReferenceEntry1Id,
      metadata: {
        type: 'ArrayReference',
        referencedBy: [entryAId],
      },
    }
    const updatedArrayReference2: Entry = {
      id: arrayReferenceEntry2Id,
      metadata: {
        type: 'ArrayReference',
        referencedBy: [entryAId],
      },
    }
    const updatedUnionEntryType2: Entry = {
      id: unionEntryType2Id,
      metadata: {
        type: 'UnionEntryType2',
        referencedBy: [entryAId],
      },
    }
    const updatedUnionNestedEntry: Entry = {
      id: unionNestedEntryId,
      metadata: {
        type: 'UnionNestedEntry',
        referencedBy: [entryAId],
      },
    }
    const updatedCircularReference1Entry: Entry = {
      id: circularReferenceEntry1Id,
      metadata: {
        type: 'CircularReferenceEntry',
        referencedBy: [entryAId, circularReferenceEntry2Id],
      },
    }

    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      entries: [
        { ...newEntryA, deletion: false },
        { ...updatedOptionalReference2, deletion: false },
        { ...updatedNonNullReference, deletion: false },
        { ...updatedArrayReference1, deletion: false },
        { ...updatedArrayReference2, deletion: false },
        { ...updatedUnionEntryType2, deletion: false },
        { ...updatedUnionNestedEntry, deletion: false },
        { ...updatedCircularReference1Entry, deletion: false },
      ],
      message: commitMessage,
    }

    const commitDraftMatcher = new Matcher<CommitDraft>((actualValue) => {
      return JSON.stringify(actualValue) === JSON.stringify(commitDraft)
    }, '')

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(schema)
    gitAdapter.getEntries
      .calledWith(commitHash)
      .mockResolvedValue(existingEntries)
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    gitAdapter.getEntries
      .calledWith(postCommitHash)
      .mockResolvedValue([
        newEntryA,
        updatedOptionalReference2,
        updatedNonNullReference,
        updatedArrayReference1,
        updatedArrayReference2,
        updatedUnionEntryType2,
        updatedUnionNestedEntry,
        updatedCircularReference1Entry,
        existingCircularReference2Entry,
      ])

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $mutationData: EntryAInput!, $commitMessage: String!) {
        data: createEntryA(id: $id, data: $mutationData, commitMessage: $commitMessage) {
          id
        }
      }`,
      variables: {
        id: entryAId,
        mutationData: mutationData,
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: entryAId,
      },
    })
    expect(result.ref).toBe(postCommitHash)
  })

  it('should not create an entry that references a non-existent entry', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const schema = `directive @Entry on OBJECT

type EntryA @Entry {
    id: ID!
    reference: EntryB!
}

type EntryB @Entry {
    id: ID!
}`

    const commitMessage = 'My message'
    const entryAId = 'A'
    const entryBId = 'B'

    const existingEntries: Entry[] = [
      { id: entryBId, metadata: { type: 'EntryB' } },
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(schema)
    gitAdapter.getEntries
      .calledWith(commitHash)
      .mockResolvedValue(existingEntries)

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $mutationData: EntryAInput!, $commitMessage: String!) {
        data: createEntryA(id: $id, data: $mutationData, commitMessage: $commitMessage) {
          id
        }
      }`,
      variables: {
        id: entryAId,
        mutationData: { reference: { id: 'someUnknownId' } },
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toMatchObject([
      {
        extensions: {
          code: 'BAD_USER_INPUT',
          commitspark: {
            fieldName: 'reference',
            fieldValue: 'someUnknownId',
          },
        },
      },
    ])
    expect(result.data).toEqual({ data: null })
    expect(result.ref).toBe(commitHash)
  })

  it('should not create an entry that references an entry of incorrect type', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const schema = `directive @Entry on OBJECT

type EntryA @Entry {
    id: ID!
    reference: EntryB!
}

type EntryB @Entry {
    id: ID!
}

type OtherEntry @Entry {
    id: ID!
}`

    const commitMessage = 'My message'
    const entryAId = 'A'
    const entryBId = 'B'
    const otherEntryId = 'otherEntryId'

    const existingEntries: Entry[] = [
      { id: entryBId, metadata: { type: 'EntryB' } },
      { id: otherEntryId, metadata: { type: 'OtherEntry' } },
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(schema)
    gitAdapter.getEntries
      .calledWith(commitHash)
      .mockResolvedValue(existingEntries)

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $mutationData: EntryAInput!, $commitMessage: String!) {
        data: createEntryA(id: $id, data: $mutationData, commitMessage: $commitMessage) {
          id
        }
      }`,
      variables: {
        id: entryAId,
        mutationData: { reference: { id: otherEntryId } },
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toMatchObject([
      {
        extensions: {
          code: 'BAD_USER_INPUT',
          commitspark: {
            fieldName: 'reference',
            fieldValue: 'otherEntryId',
          },
        },
      },
    ])
    expect(result.data).toEqual({ data: null })
    expect(result.ref).toBe(commitHash)
  })
})
