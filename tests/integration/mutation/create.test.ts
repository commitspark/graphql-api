import {
  Commit,
  CommitDraft,
  Entry,
  GitAdapter,
} from '@commitspark/git-adapter'
import { Matcher, mock } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

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
      commitHash: postCommitHash,
    }
    const newEntry: Entry = {
      id: entryAId,
      metadata: {
        type: 'EntryA',
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
    mockEntries(gitAdapter, commitHash, [])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    mockEntries(gitAdapter, postCommitHash, [newEntry])

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
      commitHash: postCommitHash,
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
        metadata: { type: 'CircularReferenceEntry' },
        data: { next: { id: circularReferenceEntry2Id } },
      },
      {
        id: circularReferenceEntry2Id,
        metadata: { type: 'CircularReferenceEntry' },
        data: { next: { id: circularReferenceEntry1Id } },
      },
    ]
    const newEntryA: Entry = {
      id: entryAId,
      metadata: {
        type: 'EntryA',
      },
      data: mutationData,
    }

    // referenced entries are not modified
    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      entries: [{ ...newEntryA, deletion: false }],
      message: commitMessage,
    }

    const commitDraftMatcher = new Matcher<CommitDraft>((actualValue) => {
      return JSON.stringify(actualValue) === JSON.stringify(commitDraft)
    }, '')

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(schema)
    mockEntries(gitAdapter, commitHash, existingEntries)
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    mockEntries(gitAdapter, postCommitHash, [...existingEntries, newEntryA])

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
    mockEntries(gitAdapter, commitHash, existingEntries)

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

  it('should not create an entry that references a non-existent entry of the same type', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const schema = `directive @Entry on OBJECT

type Person @Entry {
    id: ID!
    manager: Person
}`

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(schema)
    mockEntries(gitAdapter, commitHash, [])

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $mutationData: PersonInput!, $commitMessage: String!) {
        data: createPerson(id: $id, data: $mutationData, commitMessage: $commitMessage) {
          id
        }
      }`,
      variables: {
        id: 'employee',
        mutationData: { manager: { id: 'someUnknownId' } },
        commitMessage: 'My message',
      },
    })

    expect(result.errors).toMatchObject([
      {
        extensions: {
          code: 'BAD_USER_INPUT',
          commitspark: {
            fieldName: 'manager',
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
    mockEntries(gitAdapter, commitHash, existingEntries)

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
