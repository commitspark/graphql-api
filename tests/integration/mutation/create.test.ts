import {
  Commit,
  CommitDraft,
  ContentEntry,
  GitAdapter,
} from '@commitspark/git-adapter'
import { Matcher, mock } from 'jest-mock-extended'
import { getApiService } from '../../../src'

describe('"Create" mutation resolvers', () => {
  it('should create an entry', async () => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const originalSchema = `directive @Entry on OBJECT

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
    const newEntry: ContentEntry = {
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
      contentEntries: [{ ...newEntry, deletion: false }],
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
    gitAdapter.getContentEntries.calledWith(commitHash).mockResolvedValue([])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)
    gitAdapter.getContentEntries
      .calledWith(postCommitHash)
      .mockResolvedValue([newEntry])

    const apiService = await getApiService()
    const result = await apiService.postGraphQL(gitAdapter, gitRef, {
      query: `mutation ($id: ID!, $mutationData: EntryAInput!, $commitMessage: String!){
        data: createEntryA(id: $id, data: $mutationData, message:$commitMessage) {
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
})
