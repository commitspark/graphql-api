import {
  Commit,
  CommitDraft,
  Entry,
  GitAdapter,
} from '@commitspark/git-adapter'
import { Matcher, mock } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

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
      commitHash: postCommitHash,
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
    mockEntries(gitAdapter, commitHash, [entry])
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue(commitResult)

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
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
    mockEntries(gitAdapter, commitHash, [])

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $commitMessage: String!) {
        data: deleteEntryA(id: $id, commitMessage: $commitMessage)
      }`,
      variables: {
        id: entryAId,
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
        },
      },
    ]

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema
      .calledWith(commitHash)
      .mockResolvedValue(originalSchema)
    mockEntries(gitAdapter, commitHash, entries)

    const client = await createClient(gitAdapter)
    const result = await client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $commitMessage: String!) {
        data: deleteEntryB(id: $id, commitMessage: $commitMessage)
      }`,
      variables: {
        id: entryBId,
        commitMessage: commitMessage,
      },
    })

    expect(result.errors).toMatchObject([
      {
        extensions: {
          code: 'IN_USE',
          commitspark: {
            argumentName: 'id',
            argumentValue: entryBId,
          },
        },
      },
    ])
    expect(result.data).toEqual({ data: null })
    expect(result.ref).toBe(commitHash)
  })

  const deleteEntry = async (
    schema: string,
    entries: Entry[],
    typeName: string,
    id: string,
  ) => {
    const gitAdapter = mock<GitAdapter>()
    const gitRef = 'myRef'
    const commitHash = 'abcd'
    const postCommitHash = 'ef01'

    const entry = entries.find((existingEntry) => existingEntry.id === id)
    const commitDraft: CommitDraft = {
      ref: gitRef,
      parentSha: commitHash,
      entries: [{ ...(entry as Entry), deletion: true }],
      message: 'My message',
    }
    const commitDraftMatcher = new Matcher<CommitDraft>((actualValue) => {
      return JSON.stringify(actualValue) === JSON.stringify(commitDraft)
    }, '')

    gitAdapter.getLatestCommitHash
      .calledWith(gitRef)
      .mockResolvedValue(commitHash)
    gitAdapter.getSchema.calledWith(commitHash).mockResolvedValue(schema)
    mockEntries(gitAdapter, commitHash, entries)
    gitAdapter.createCommit
      .calledWith(commitDraftMatcher)
      .mockResolvedValue({ commitHash: postCommitHash })

    const client = await createClient(gitAdapter)
    return client.postGraphQL(gitRef, {
      query: `mutation ($id: ID!, $commitMessage: String!) {
        data: delete${typeName}(id: $id, commitMessage: $commitMessage)
      }`,
      variables: {
        id: id,
        commitMessage: 'My message',
      },
    })
  }

  it('should delete an entry without modifying the entries it references', async () => {
    const schema = `directive @Entry on OBJECT

type Item @Entry {
    id: ID!
    box: Box!
}

type Box @Entry {
    id: ID!
}`
    const entries: Entry[] = [
      { id: 'box', metadata: { type: 'Box' } },
      { id: 'item1', metadata: { type: 'Item' }, data: { box: { id: 'box' } } },
      { id: 'item2', metadata: { type: 'Item' }, data: { box: { id: 'box' } } },
    ]

    const result = await deleteEntry(schema, entries, 'Item', 'item1')

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({ data: 'item1' })
    expect(result.ref).toBe('ef01')
  })

  it('should delete an entry that references itself', async () => {
    const schema = `directive @Entry on OBJECT

type Person @Entry {
    id: ID!
    manager: Person
}`
    const entries: Entry[] = [
      {
        id: 'ceo',
        metadata: { type: 'Person' },
        data: { manager: { id: 'ceo' } },
      },
    ]

    const result = await deleteEntry(schema, entries, 'Person', 'ceo')

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({ data: 'ceo' })
  })

  it('should return an error when trying to delete an entry that is referenced by an entry of the same type', async () => {
    const schema = `directive @Entry on OBJECT

type Person @Entry {
    id: ID!
    manager: Person
}`
    const entries: Entry[] = [
      { id: 'manager', metadata: { type: 'Person' } },
      {
        id: 'employee',
        metadata: { type: 'Person' },
        data: { manager: { id: 'manager' } },
      },
    ]

    const result = await deleteEntry(schema, entries, 'Person', 'manager')

    expect(result.errors).toMatchObject([
      {
        message:
          'Entry with ID "manager" is still referenced by entries ["employee"].',
        extensions: { code: 'IN_USE' },
      },
    ])
    expect(result.data).toEqual({ data: null })
  })

  it('should ignore reference metadata stored in entries', async () => {
    const schema = `directive @Entry on OBJECT

type Item @Entry {
    id: ID!
    box: Box
}

type Box @Entry {
    id: ID!
}`
    const entries: Entry[] = [
      // stale reference metadata written by earlier versions
      { id: 'box', metadata: { type: 'Box', referencedBy: ['item'] } },
      { id: 'item', metadata: { type: 'Item' }, data: { box: null } },
    ]

    const result = await deleteEntry(schema, entries, 'Box', 'box')

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({ data: 'box' })
  })

  it('should return an error when an entry of a type unknown to the schema exists', async () => {
    const schema = `directive @Entry on OBJECT

type Box @Entry {
    id: ID!
}`
    const entries: Entry[] = [
      { id: 'box', metadata: { type: 'Box' } },
      { id: 'orphan', metadata: { type: 'RemovedType' } },
    ]

    const result = await deleteEntry(schema, entries, 'Box', 'box')

    expect(result.errors).toMatchObject([
      {
        extensions: {
          code: 'BAD_REPOSITORY_DATA',
          commitspark: { typeName: 'RemovedType', fieldValue: 'orphan' },
        },
      },
    ])
    expect(result.data).toEqual({ data: null })
  })
})
