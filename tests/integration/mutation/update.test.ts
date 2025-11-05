import {
  Commit,
  CommitDraft,
  Entry,
  GitAdapter,
} from '@commitspark/git-adapter'
import { Matcher, mock } from 'jest-mock-extended'
import { createClient } from '../../../src'

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
      ref: postCommitHash,
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
    gitAdapter.getEntries
      .calledWith(commitHash)
      .mockResolvedValue([originalEntry])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    gitAdapter.getEntries
      .calledWith(postCommitHash)
      .mockResolvedValue([updatedEntry])

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
      ref: postCommitHash,
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
    gitAdapter.getEntries
      .calledWith(commitHash)
      .mockResolvedValue([originalEntry])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    gitAdapter.getEntries
      .calledWith(postCommitHash)
      .mockResolvedValue([updatedEntry])

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
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue([])

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
      { extensions: { argumentName: 'id', code: 'BAD_USER_INPUT' } },
    ])
    expect(result.data).toEqual({ data: null })
    expect(result.ref).toBe(commitHash)
  })

  it('should update reference metadata of other entries when updating an entry', async () => {
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
    const item1Id = 'item1'
    const item2Id = 'item2'
    const postCommitHash = 'ef01'

    const commitResult: Commit = {
      ref: postCommitHash,
    }
    const box1: Entry = {
      id: box1Id,
      metadata: {
        type: 'Box',
        referencedBy: [item1Id],
      },
    }
    const box2: Entry = {
      id: box2Id,
      metadata: {
        type: 'Box',
        referencedBy: [item2Id],
      },
    }
    const item1: Entry = {
      id: item1Id,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: box1Id },
      },
    }
    const item2: Entry = {
      id: item2Id,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: box2Id },
      },
    }
    const updatedItem1: Entry = {
      id: item1Id,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: box2Id },
      },
    }
    const updatedBox1: Entry = {
      id: box1Id,
      metadata: {
        type: 'Box',
        referencedBy: [],
      },
    }
    const updatedBox2: Entry = {
      id: box2Id,
      metadata: {
        type: 'Box',
        referencedBy: [item1Id, item2Id],
      },
    }

    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      entries: [
        { ...updatedItem1, deletion: false },
        { ...updatedBox1, deletion: false },
        { ...updatedBox2, deletion: false },
      ],
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
    gitAdapter.getEntries
      .calledWith(commitHash)
      .mockResolvedValue([box1, box2, item1, item2])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    gitAdapter.getEntries
      .calledWith(postCommitHash)
      .mockResolvedValue([updatedBox1, updatedBox2, updatedItem1, item2])

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $mutationData: ItemInput!, $commitMessage: String!) {
        data: updateItem(id: $id, data: $mutationData, commitMessage: $commitMessage) {
          id
        }
      }`,
      variables: {
        id: item1Id,
        mutationData: {
          box: { id: box2Id },
        },
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: {
        id: item1Id,
      },
    })
    expect(result.ref).toBe(postCommitHash)
  })

  it('should not add more than one reference in metadata of referenced entries when setting a second reference from an entry already having a reference in place', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type Item @Entry {
    id: ID!
    box: Box
    boxAlias: Box
}

type Box @Entry {
    id: ID!
}`

    const commitMessage = 'My message'
    const boxId = 'box'
    const itemId = 'item'
    const postCommitHash = 'ef01'

    const commitResult: Commit = {
      ref: postCommitHash,
    }
    const box: Entry = {
      id: boxId,
      metadata: {
        type: 'Box',
        referencedBy: [itemId],
      },
    }
    const item: Entry = {
      id: itemId,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: boxId },
        // boxAlias is intentionally not referencing anything
      },
    }
    const updatedItem: Entry = {
      id: itemId,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: boxId },
        boxAlias: { id: boxId }, // now reference same box as `box` field
      },
    }
    const updatedBox: Entry = {
      id: boxId,
      metadata: {
        type: 'Box',
        referencedBy: [itemId], // expect a single record per incoming reference
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
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue([box, item])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    gitAdapter.getEntries
      .calledWith(postCommitHash)
      .mockResolvedValue([updatedBox, updatedItem])

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
          boxAlias: { id: boxId },
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

  it('should not add more than one reference in metadata of referenced entries when changing an entry having two different references to now reference the same entry twice', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

type Item @Entry {
    id: ID!
    box: Box
    boxAlias: Box
}

type Box @Entry {
    id: ID!
}`

    const commitMessage = 'My message'
    const boxId = 'box'
    const otherBoxId = 'otherBox'
    const itemId = 'item'
    const postCommitHash = 'ef01'

    const commitResult: Commit = {
      ref: postCommitHash,
    }
    const box: Entry = {
      id: boxId,
      metadata: {
        type: 'Box',
        referencedBy: [itemId],
      },
    }
    const otherBox: Entry = {
      id: otherBoxId,
      metadata: {
        type: 'Box',
        referencedBy: [itemId],
      },
    }
    const item: Entry = {
      id: itemId,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: boxId },
        boxAlias: { id: otherBoxId },
      },
    }
    const updatedItem: Entry = {
      id: itemId,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: boxId },
        boxAlias: { id: boxId },
      },
    }
    const updatedBox: Entry = {
      id: boxId,
      metadata: {
        type: 'Box',
        referencedBy: [itemId], // expect a single record per incoming reference
      },
    }
    const updatedOtherBox: Entry = {
      id: otherBoxId,
      metadata: {
        type: 'Box',
        referencedBy: [], // no longer referenced
      },
    }

    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      entries: [
        { ...updatedItem, deletion: false },
        { ...updatedOtherBox, deletion: false },
      ],
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
    gitAdapter.getEntries
      .calledWith(commitHash)
      .mockResolvedValue([box, otherBox, item])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    gitAdapter.getEntries
      .calledWith(postCommitHash)
      .mockResolvedValue([updatedBox, updatedOtherBox, updatedItem])

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
          boxAlias: { id: boxId },
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
})
