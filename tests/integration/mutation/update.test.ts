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
        data: updateEntryA(id: $id, data: $mutationData, message:$commitMessage) {
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
        data: updateEntryA(id: $id, data: $mutationData, message:$commitMessage) {
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
})
