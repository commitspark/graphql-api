import {
  Commit,
  CommitDraft,
  Entry,
  GitAdapter,
} from '@commitspark/git-adapter'
import { Matcher, mock } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

describe('"Update" mutation resolvers', () => {
  it('should update an entry', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type EntryA @Entry {
    id: ID!
    name: String
}`

    const commitMessage = 'My message'
    const entryAId = 'A'
    const postCommitHash = 'ef01'

    const mutationData = {
      name: 'My name',
    }
    const commitResult: Commit = {
      commitHash: postCommitHash,
    }
    const originalEntry: Entry = {
      id: entryAId,
      metadata: {
        type: 'EntryA',
      },
      data: {
        name: `${mutationData.name}1`,
      },
    }

    const updatedEntry: Entry = {
      id: entryAId,
      metadata: {
        type: 'EntryA',
      },
      data: {
        name: `${mutationData.name}2`,
      },
    }

    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      entries: [{ ...updatedEntry, deletion: false }],
      message: commitMessage,
    }

    const commitDraftMatcher = new Matcher<CommitDraft>((actualValue) => {
      return JSON.stringify(actualValue) === JSON.stringify(commitDraft)
    }, '')

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    mockEntries(gitAdapter, commitHash, [originalEntry])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    mockEntries(gitAdapter, postCommitHash, [updatedEntry])

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $mutationData: EntryAInput!, $commitMessage: String!) {
        data: updateEntryA(id: $id, data: $mutationData, commitMessage: $commitMessage) {
          id
          name
        }
      }`,
      variables: {
        id: entryAId,
        mutationData: {
          name: `${mutationData.name}2`,
        },
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: entryAId,
        name: `${mutationData.name}2`,
      },
    })
    expect(result.ref).toBe(postCommitHash)
  })

  it('should update an entry only where data was provided (partial update)', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type EntryA @Entry {
    id: ID!
    fieldChanged: String
    fieldNulled: String
    fieldNotSpecified: String
    fieldUndefinedData: String
    subTypeChanged: SubType
    subTypeNulled: SubType
    subTypeNotSpecified: SubType
    subTypeUndefinedData: SubType
    arrayChanged: [SubType!]
    arrayNulled: [SubType!]
    arrayNotSpecified: [SubType!]
    arrayUndefinedData: [SubType!]
}

type SubType {
    field1: String
    field2: String
}`

    const commitMessage = 'My message'
    const entryId = 'A'
    const postCommitHash = 'ef01'

    const originalValue = 'original'
    const commitResult: Commit = {
      commitHash: postCommitHash,
    }
    const originalEntry: Entry = {
      id: entryId,
      metadata: {
        type: 'EntryA',
      },
      data: {
        fieldChanged: originalValue,
        fieldNulled: originalValue,
        fieldNotSpecified: originalValue,
        subTypeChanged: {
          field1: originalValue,
        },
        subTypeNulled: {
          field1: originalValue,
        },
        subTypeNotSpecified: {
          field1: originalValue,
        },
        arrayChanged: [{ field1: originalValue }],
        arrayNulled: [{ field1: originalValue }],
        arrayNotSpecified: [{ field1: originalValue }],
      },
    }

    const changedValue = 'changed'
    const mutationData = {
      fieldChanged: changedValue,
      fieldNulled: null,
      fieldUndefinedData: changedValue,
      subTypeChanged: { field2: changedValue },
      subTypeNulled: null,
      subTypeUndefinedData: { field2: changedValue },
      arrayChanged: [{ field2: changedValue }],
      arrayNulled: null,
      arrayUndefinedData: [{ field2: changedValue }],
    }

    const updatedEntry: Entry = {
      id: entryId,
      metadata: {
        type: 'EntryA',
      },
      data: {
        fieldChanged: changedValue,
        fieldNulled: null,
        fieldNotSpecified: originalValue,
        subTypeChanged: {
          field2: changedValue,
        },
        subTypeNulled: null,
        subTypeNotSpecified: {
          field1: originalValue,
        },
        arrayChanged: [{ field2: changedValue }],
        arrayNulled: null,
        arrayNotSpecified: [{ field1: originalValue }],
        // we only do a dumb equality check using JSON below, so order matters and these fields were added
        fieldUndefinedData: changedValue,
        subTypeUndefinedData: {
          field2: changedValue,
        },
        arrayUndefinedData: [{ field2: changedValue }],
      },
    }

    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      entries: [{ ...updatedEntry, deletion: false }],
      message: commitMessage,
    }

    const commitDraftMatcher = new Matcher<CommitDraft>((actualValue) => {
      return JSON.stringify(actualValue) === JSON.stringify(commitDraft)
    }, '')

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    mockEntries(gitAdapter, commitHash, [originalEntry])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    mockEntries(gitAdapter, postCommitHash, [updatedEntry])

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $mutationData: EntryAInput!, $commitMessage: String!) {
        data: updateEntryA(id: $id, data: $mutationData, commitMessage: $commitMessage) {
          id
        }
      }`,
      variables: {
        id: entryId,
        mutationData: mutationData,
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({ data: { id: entryId } })
    expect(result.ref).toBe(postCommitHash)
  })

  it('should return an error when trying to update a non-existent entry', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type EntryA @Entry {
    id: ID!
    name: String
}`

    const commitMessage = 'My message'
    const entryAId = 'A'

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    mockEntries(gitAdapter, commitHash, [])

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $mutationData: EntryAInput!, $commitMessage: String!) {
        data: updateEntryA(id: $id, data: $mutationData, commitMessage: $commitMessage) {
          id
          name
        }
      }`,
      variables: {
        id: entryAId,
        mutationData: {
          name: '2',
        },
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toMatchObject([
      {
        extensions: {
          code: 'NOT_FOUND',
          commitspark: {
            argumentName: 'id',
            argumentValue: entryAId,
          },
        },
      },
    ])
    expect(result.data).toEqual({ data: null })
    expect(result.ref).toBe(commitHash)
  })

  it('should only write the updated entry when changing a reference', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type Item @Entry {
    id: ID!
    box: Box!
}

type Box @Entry {
    id: ID!
}`

    const commitMessage = 'My message'
    const box1Id = 'box1'
    const box2Id = 'box2'
    const itemId = 'item'
    const postCommitHash = 'ef01'

    const commitResult: Commit = {
      commitHash: postCommitHash,
    }
    const box1: Entry = {
      id: box1Id,
      metadata: { type: 'Box' },
    }
    const box2: Entry = {
      id: box2Id,
      metadata: { type: 'Box' },
    }
    const item: Entry = {
      id: itemId,
      metadata: {
        type: 'Item',
        // reference metadata written by earlier versions is removed when an entry is written
        referencedBy: [],
      },
      data: {
        box: { id: box1Id },
      },
    }
    const updatedItem: Entry = {
      id: itemId,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: box2Id },
      },
    }

    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      entries: [{ ...updatedItem, deletion: false }],
      message: commitMessage,
    }

    const commitDraftMatcher = new Matcher<CommitDraft>((actualValue) => {
      return JSON.stringify(actualValue) === JSON.stringify(commitDraft)
    }, '')

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    mockEntries(gitAdapter, commitHash, [box1, box2, item])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    mockEntries(gitAdapter, postCommitHash, [box1, box2, updatedItem])

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $mutationData: ItemInput!, $commitMessage: String!) {
        data: updateItem(id: $id, data: $mutationData, commitMessage: $commitMessage) {
          id
        }
      }`,
      variables: {
        id: itemId,
        mutationData: {
          box: { id: box2Id },
        },
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: itemId,
      },
    })
    expect(result.ref).toBe(postCommitHash)
  })

  it('should update non-null fields of an entry', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type EntryA @Entry {
    id: ID!
    string: String!
    int: Int!
    float: Float!
    boolean: Boolean!
    enum: MyEnum!
}

enum MyEnum {
    A
    B
}`

    const commitMessage = 'My message'
    const entryAId = 'A'
    const postCommitHash = 'ef01'

    const mutationData = {
      string: 'My name',
      int: 100,
      float: 200.0,
      boolean: true,
      enum: 'B',
    }

    const commitResult: Commit = {
      commitHash: postCommitHash,
    }
    const originalEntry: Entry = {
      id: entryAId,
      metadata: {
        type: 'EntryA',
      },
      data: {
        string: 'text',
        int: 10,
        float: 20.0,
        boolean: false,
        enum: 'A',
      },
    }

    const updatedEntry: Entry = {
      id: entryAId,
      metadata: {
        type: 'EntryA',
      },
      data: { ...mutationData },
    }

    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      entries: [{ ...updatedEntry, deletion: false }],
      message: commitMessage,
    }

    const commitDraftMatcher = new Matcher<CommitDraft>((actualValue) => {
      return JSON.stringify(actualValue) === JSON.stringify(commitDraft)
    }, '')

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    mockEntries(gitAdapter, commitHash, [originalEntry])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    mockEntries(gitAdapter, postCommitHash, [updatedEntry])

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $mutationData: EntryAInput!, $commitMessage: String!) {
        data: updateEntryA(id: $id, data: $mutationData, commitMessage: $commitMessage) {
          id
          string
          int
          float
          boolean
          enum
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
        ...mutationData,
        id: entryAId,
      },
    })
    expect(result.ref).toBe(postCommitHash)
  })
})
