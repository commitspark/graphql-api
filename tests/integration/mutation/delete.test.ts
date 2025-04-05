import {
  Commit,
  CommitDraft,
  Entry,
  GitAdapter,
} from '@commitspark/git-adapter'
import { Matcher, mock } from 'jest-mock-extended'
import { getApiService } from '@/index'

describe('"Delete" mutation resolvers', () => {
  it('should delete an entry', async () => {
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

    const commitResult: Commit = {
      ref: postCommitHash,
    }
    const entry: Entry = {
      id: entryAId,
      metadata: {
        type: 'EntryA',
      },
      data: {
        name: 'My name',
      },
    }

    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      entries: [
        {
          ...entry,
          deletion: true,
        },
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
    gitAdapter.getEntries.calledWith(commitHash).mockResolvedValue([entry])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `mutation ($id: ID!, $commitMessage: String!) {
        data: deleteEntryA(id: $id, commitMessage: $commitMessage)
      }`,
      variables: {
        id: entryAId,
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: entryAId,
    })
    expect(result.ref).toBe(postCommitHash)
  })

  it('should return an error when trying to delete a non-existent entry', async () => {
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

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `mutation ($id: ID!, $commitMessage: String!) {
        data: deleteEntryA(id: $id, commitMessage: $commitMessage)
      }`,
      variables: {
        id: entryAId,
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toMatchObject([
      { extensions: { argumentName: 'id', code: 'BAD_USER_INPUT' } },
    ])
    expect(result.data).toEqual({ data: null })
    expect(result.ref).toBe(commitHash)
  })

  it('should return an error when trying to delete an entry that is referenced elsewhere', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

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

    const entries: Entry[] = [
      {
        id: entryAId,
        metadata: {
          type: 'EntryA',
        },
        data: {
          reference: {
            id: entryBId,
          },
        },
      },
      {
        id: entryBId,
        metadata: {
          type: 'EntryB',
          referencedBy: [entryAId],
        },
      },
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
      query: `mutation ($id: ID!, $commitMessage: String!) {
        data: deleteEntryB(id: $id, commitMessage: $commitMessage)
      }`,
      variables: {
        id: entryBId,
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toMatchObject([
      { extensions: { argumentName: 'id', code: 'IN_USE' } },
    ])
    expect(result.data).toEqual({ data: null })
    expect(result.ref).toBe(commitHash)
  })

  it('should remove references from metadata of other entries when deleting an entry', async () => {
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
    const boxId = 'box'
    const item1Id = 'item1'
    const item2Id = 'item2'
    const postCommitHash = 'ef01'

    const commitResult: Commit = {
      ref: postCommitHash,
    }
    const box: Entry = {
      id: boxId,
      metadata: {
        type: 'Box',
        referencedBy: [item1Id, item2Id],
      },
    }
    const item1: Entry = {
      id: item1Id,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: boxId },
      },
    }
    const item2: Entry = {
      id: item2Id,
      metadata: {
        type: 'Item',
      },
      data: {
        box: { id: boxId },
      },
    }
    const updatedBox: Entry = {
      id: boxId,
      metadata: {
        type: 'Box',
        referencedBy: [item2Id],
      },
    }

    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      entries: [
        { ...item1, deletion: true },
        { ...updatedBox, deletion: false },
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
      .mockResolvedValue([box, item1, item2])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    gitAdapter.getEntries
      .calledWith(postCommitHash)
      .mockResolvedValue([updatedBox, item2])

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `mutation ($id: ID!, $commitMessage: String!) {
        data: deleteItem(id: $id, commitMessage: $commitMessage)
      }`,
      variables: {
        id: item1Id,
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      data: item1Id,
    })
    expect(result.ref).toBe(postCommitHash)
  })
})
