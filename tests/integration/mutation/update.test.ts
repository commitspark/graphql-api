import {
  Commit,
  CommitDraft,
  ContentEntry,
  GitAdapter,
} from '@commitspark/git-adapter'
import { Matcher, mock } from 'jest-mock-extended'
import { getApiService } from '../../../src'

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
    const originalEntry: ContentEntry = {
      id: entryAId,
      metadata: {
        type: 'EntryA',
      },
      data: {
        name: `${mutationData.name}1`,
      },
    }

    const updatedEntry: ContentEntry = {
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
      contentEntries: [{ ...updatedEntry, deletion: false }],
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
    gitAdapter.getContentEntries
      .calledWith(commitHash)
      .mockResolvedValue([originalEntry])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    gitAdapter.getContentEntries
      .calledWith(postCommitHash)
      .mockResolvedValue([updatedEntry])

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `mutation ($id: ID!, $mutationData: EntryAInput!, $commitMessage: String!){
        data: updateEntryA(id: $id, data: $mutationData, message: $commitMessage) {
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

  // TODO assert partial update leaves data of existing unspecified optional fields in place, sets data of all other provided fields to provided values

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
    gitAdapter.getContentEntries.calledWith(commitHash).mockResolvedValue([])

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `mutation ($id: ID!, $mutationData: EntryAInput!, $commitMessage: String!){
        data: updateEntryA(id: $id, data: $mutationData, message: $commitMessage) {
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
    const box1: ContentEntry = {
      id: box1Id,
      metadata: {
        type: 'Box',
        referencedBy: [item1Id],
      },
    }
    const box2: ContentEntry = {
      id: box2Id,
      metadata: {
        type: 'Box',
        referencedBy: [item2Id],
      },
    }
    const item1: ContentEntry = {
      id: item1Id,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: box1Id },
      },
    }
    const item2: ContentEntry = {
      id: item2Id,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: box2Id },
      },
    }
    const updatedItem1: ContentEntry = {
      id: item1Id,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: box2Id },
      },
    }
    const updatedBox1: ContentEntry = {
      id: box1Id,
      metadata: {
        type: 'Box',
        referencedBy: [],
      },
    }
    const updatedBox2: ContentEntry = {
      id: box2Id,
      metadata: {
        type: 'Box',
        referencedBy: [item1Id, item2Id],
      },
    }

    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      contentEntries: [
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
    gitAdapter.getContentEntries
      .calledWith(commitHash)
      .mockResolvedValue([box1, box2, item1, item2])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    gitAdapter.getContentEntries
      .calledWith(postCommitHash)
      .mockResolvedValue([updatedBox1, updatedBox2, updatedItem1, item2])

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `mutation ($id: ID!, $mutationData: ItemInput!, $commitMessage: String!){
        data: updateItem(id: $id, data: $mutationData, message: $commitMessage) {
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

  it('should not add more than one reference in metadata of other entries when updating an entry', async () => {
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
    const box: ContentEntry = {
      id: boxId,
      metadata: {
        type: 'Box',
        referencedBy: [itemId],
      },
    }
    const item: ContentEntry = {
      id: itemId,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: boxId },
      },
    }
    const updatedItem: ContentEntry = {
      id: itemId,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: boxId },
        boxAlias: { id: boxId },
      },
    }
    const updatedBox: ContentEntry = {
      id: boxId,
      metadata: {
        type: 'Box',
        referencedBy: [itemId],
      },
    }

    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      contentEntries: [{ ...updatedItem, deletion: false }],
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
    gitAdapter.getContentEntries
      .calledWith(commitHash)
      .mockResolvedValue([box, item])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    gitAdapter.getContentEntries
      .calledWith(postCommitHash)
      .mockResolvedValue([updatedBox, updatedItem])

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `mutation ($id: ID!, $mutationData: ItemInput!, $commitMessage: String!){
        data: updateItem(id: $id, data: $mutationData, message: $commitMessage) {
          id
        }
      }`,
      variables: {
        id: itemId,
        mutationData: {
          box: { id: boxId },
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
