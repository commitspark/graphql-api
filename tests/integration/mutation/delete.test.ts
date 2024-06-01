import {
  Commit,
  CommitDraft,
  ContentEntry,
  GitAdapter,
} from '@commitspark/git-adapter'
import { Matcher, mock } from 'jest-mock-extended'
import { getApiService } from '../../../src'

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
    const entry: ContentEntry = {
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
      contentEntries: [
        {
          id: entryAId,
          metadata: { type: 'EntryA' },
          data: {},
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
    gitAdapter.getContentEntries
      .calledWith(commitHash)
      .mockResolvedValue([entry])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `mutation ($id: ID!, $commitMessage: String!){
        data: deleteEntryA(id: $id, message:$commitMessage) {
          id
        }
      }`,
      variables: {
        id: entryAId,
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
    gitAdapter.getContentEntries.calledWith(commitHash).mockResolvedValue([])

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `mutation ($id: ID!, $commitMessage: String!){
        data: deleteEntryA(id: $id, message:$commitMessage) {
          id
        }
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

    const entries: ContentEntry[] = [
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
    gitAdapter.getContentEntries
      .calledWith(commitHash)
      .mockResolvedValue(entries)

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `mutation ($id: ID!, $commitMessage: String!) {
        data: deleteEntryB(id: $id, message: $commitMessage) {
          id
        }
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
})
