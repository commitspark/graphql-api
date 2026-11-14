import {
  Entry,
  ErrorCode as GitAdapterErrorCode,
  GitAdapter,
  GitAdapterError,
} from '@commitspark/git-adapter'
import { mock, MockProxy } from 'jest-mock-extended'
import { createClient } from '../../../src'
import { mockEntries } from '../../git-adapter-mock'

const branch = 'main'
const headHash = 'head'
const newHash = 'new'

const schema = `directive @Entry on OBJECT

type Author @Entry {
    id: ID!
    name: String
    favorite: Book
}

type Book @Entry {
    id: ID!
    title: String
    author: Author!
}`

function createGitAdapter(
  entries: Entry[],
  schemaString = schema,
): MockProxy<GitAdapter> {
  const gitAdapter = mock<GitAdapter>()
  gitAdapter.getLatestCommitHash.calledWith(branch).mockResolvedValue(headHash)
  gitAdapter.getSchema.calledWith(headHash).mockResolvedValue(schemaString)
  mockEntries(gitAdapter, headHash, entries)
  gitAdapter.createCommit.mockResolvedValue({ commitHash: newHash })
  return gitAdapter
}

const ada: Entry = {
  id: 'ada',
  metadata: { type: 'Author' },
  data: { name: 'Ada' },
}
const book: Entry = {
  id: 'book',
  metadata: { type: 'Book' },
  data: { title: 'Notes', author: { id: 'ada' } },
}

describe('Migrations', () => {
  it('should commit schema and entries together in a single commit', async () => {
    const gitAdapter = createGitAdapter([ada, book])
    const client = await createClient(gitAdapter)
    const newSchema = schema.replace('name: String', 'fullName: String')

    const result = await client.migrate(branch, (snapshot) => {
      const author = snapshot.entries.get('ada') as Entry
      const { name, ...data } = author.data ?? {}
      return {
        schema: snapshot.schema.replace('name: String', 'fullName: String'),
        entries: [
          { ...author, data: { ...data, fullName: name }, deletion: false },
        ],
        commit: { message: 'Rename name to fullName', body: 'Details' },
      }
    })

    expect(result).toEqual({ ref: newHash })
    expect(gitAdapter.createCommit).toHaveBeenCalledTimes(1)
    expect(gitAdapter.createCommit).toHaveBeenCalledWith({
      ref: branch,
      parentSha: headHash,
      message: 'Rename name to fullName',
      body: 'Details',
      schema: newSchema,
      entries: [
        {
          id: 'ada',
          metadata: { type: 'Author' },
          data: { fullName: 'Ada' },
          deletion: false,
        },
      ],
    })
  })

  it('should pass a snapshot with all entries, the schema and the commit hash', async () => {
    const unknownTypeEntry: Entry = {
      id: 'legacy',
      metadata: { type: 'Removed' },
      data: { a: 1 },
    }
    const gitAdapter = createGitAdapter([ada, book, unknownTypeEntry])
    const client = await createClient(gitAdapter)

    let snapshotRef: string | undefined
    let snapshotSchema: string | undefined
    let snapshotEntries: Entry[] = []
    await client.migrate(branch, (snapshot) => {
      snapshotRef = snapshot.ref
      snapshotSchema = snapshot.schema
      snapshotEntries = [...snapshot.entries.values()]
      return { entries: [] }
    })

    expect(snapshotRef).toEqual(headHash)
    expect(snapshotSchema).toEqual(schema)
    expect(snapshotEntries).toEqual([ada, book, unknownTypeEntry])
  })

  it('should create entries that require each other in a single commit', async () => {
    const gitAdapter = createGitAdapter(
      [],
      schema.replace('favorite: Book', 'favorite: Book!'),
    )
    const client = await createClient(gitAdapter)

    await client.migrate(branch, () => ({
      entries: [
        {
          id: 'grace',
          metadata: { type: 'Author' },
          data: { favorite: { id: 'manual' } },
          deletion: false,
        },
        {
          id: 'manual',
          metadata: { type: 'Book' },
          data: { author: { id: 'grace' } },
          deletion: false,
        },
      ],
    }))

    expect(gitAdapter.createCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Migrate entries',
        entries: [
          expect.objectContaining({ id: 'grace' }),
          expect.objectContaining({ id: 'manual' }),
        ],
      }),
    )
    expect(gitAdapter.createCommit.mock.calls[0][0]).not.toHaveProperty(
      'schema',
    )
  })

  it('should delete a referenced entry together with the entry referencing it', async () => {
    const gitAdapter = createGitAdapter([ada, book])
    const client = await createClient(gitAdapter)

    await client.migrate(branch, (snapshot) => ({
      entries: [
        { ...(snapshot.entries.get('ada') as Entry), deletion: true },
        { ...(snapshot.entries.get('book') as Entry), deletion: true },
      ],
    }))

    expect(gitAdapter.createCommit).toHaveBeenCalledTimes(1)
  })

  it('should not commit if the result leaves a dangling reference', async () => {
    const gitAdapter = createGitAdapter([ada, book])
    const client = await createClient(gitAdapter)

    await expect(
      client.migrate(branch, (snapshot) => ({
        entries: [
          { ...(snapshot.entries.get('ada') as Entry), deletion: true },
        ],
      })),
    ).rejects.toMatchObject({
      extensions: {
        code: 'BAD_USER_INPUT',
        commitspark: {
          violations: [
            expect.objectContaining({
              code: 'DANGLING_REFERENCE',
              entryId: 'book',
              path: ['author'],
            }),
          ],
        },
      },
    })
    expect(gitAdapter.createCommit).not.toHaveBeenCalled()
  })

  it('should not commit an invalid schema', async () => {
    const gitAdapter = createGitAdapter([ada, book])
    const client = await createClient(gitAdapter)

    await expect(
      client.migrate(branch, () => ({
        schema: 'type Broken {',
        entries: [],
      })),
    ).rejects.toMatchObject({
      extensions: {
        code: 'BAD_USER_INPUT',
        commitspark: {
          violations: [expect.objectContaining({ code: 'INVALID_SCHEMA' })],
        },
      },
    })
    expect(gitAdapter.createCommit).not.toHaveBeenCalled()
  })

  it('should require all entries to be valid if the schema changes', async () => {
    const gitAdapter = createGitAdapter([ada, book])
    const client = await createClient(gitAdapter)

    await expect(
      client.migrate(branch, (snapshot) => ({
        schema: snapshot.schema.replace('favorite: Book', 'favorite: Book!'),
        entries: [],
      })),
    ).rejects.toMatchObject({
      extensions: {
        commitspark: {
          violations: [
            expect.objectContaining({
              code: 'INVALID_VALUE',
              entryId: 'ada',
              path: ['favorite'],
            }),
          ],
        },
      },
    })
    expect(gitAdapter.createCommit).not.toHaveBeenCalled()
  })

  it('should not block a migration by errors that existed before if the schema stays unchanged', async () => {
    const invalidBook: Entry = {
      id: 'invalid',
      metadata: { type: 'Book' },
      data: { title: 5, author: { id: 'ada' } },
    }
    const gitAdapter = createGitAdapter([ada, book, invalidBook])
    const client = await createClient(gitAdapter)

    await client.migrate(branch, (snapshot) => ({
      entries: [
        {
          ...(snapshot.entries.get('ada') as Entry),
          data: { name: 'Ada Lovelace' },
          deletion: false,
        },
        {
          ...(snapshot.entries.get('invalid') as Entry),
          data: { title: 5, author: { id: 'ada' }, extra: true },
          deletion: false,
        },
      ],
    }))

    expect(gitAdapter.createCommit).toHaveBeenCalledTimes(1)
  })

  it('should only commit entries that change and not commit at all without changes', async () => {
    const gitAdapter = createGitAdapter([ada, book])
    const client = await createClient(gitAdapter)

    const result = await client.migrate(branch, (snapshot) => ({
      schema: snapshot.schema,
      entries: [...snapshot.entries.values()].map((entry) => ({
        ...entry,
        deletion: false,
      })),
    }))

    expect(result).toEqual({ ref: headHash })
    expect(gitAdapter.createCommit).not.toHaveBeenCalled()
  })

  it('should run the migration again on the new head if the branch moved', async () => {
    const gitAdapter = createGitAdapter([ada, book])
    const movedHash = 'moved'
    const movedAda: Entry = { ...ada, data: { name: 'Ada King' } }
    mockEntries(gitAdapter, movedHash, [movedAda, book])
    gitAdapter.getSchema.calledWith(movedHash).mockResolvedValue(schema)
    gitAdapter.createCommit
      .mockRejectedValueOnce(
        new GitAdapterError(GitAdapterErrorCode.CONFLICT, 'Branch moved'),
      )
      .mockResolvedValueOnce({ commitHash: newHash })
    gitAdapter.getLatestCommitHash
      .calledWith(branch)
      .mockResolvedValueOnce(headHash)
      .mockResolvedValueOnce(movedHash)
    const client = await createClient(gitAdapter)

    const snapshotRefs: string[] = []
    const result = await client.migrate(branch, (snapshot) => {
      snapshotRefs.push(snapshot.ref)
      const author = snapshot.entries.get('ada') as Entry
      return {
        entries: [
          {
            ...author,
            data: { ...author.data, favorite: { id: 'book' } },
            deletion: false,
          },
        ],
      }
    })

    expect(result).toEqual({ ref: newHash })
    expect(snapshotRefs).toEqual([headHash, movedHash])
    expect(gitAdapter.createCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        parentSha: movedHash,
        entries: [
          expect.objectContaining({
            data: { name: 'Ada King', favorite: { id: 'book' } },
          }),
        ],
      }),
    )
  })

  it.each<[string, (snapshot: Map<string, Entry>) => Entry[]]>([
    [
      'an ID contained more than once',
      (entries) => [entries.get('ada') as Entry, entries.get('ada') as Entry],
    ],
    [
      'the deletion of an entry that does not exist',
      () => [{ id: 'missing', metadata: { type: 'Author' } }],
    ],
    [
      'a new ID that is not in composed Unicode form',
      () => [{ id: 'café', metadata: { type: 'Author' }, data: {} }],
    ],
    [
      'a new ID with invalid characters',
      () => [{ id: 'a:b', metadata: { type: 'Author' }, data: {} }],
    ],
  ])('should reject %s', async (description, getEntries) => {
    const gitAdapter = createGitAdapter([ada, book])
    const client = await createClient(gitAdapter)

    await expect(
      client.migrate(branch, (snapshot) => ({
        entries: getEntries(snapshot.entries as Map<string, Entry>).map(
          (entry) => ({
            ...entry,
            deletion: description.includes('deletion'),
          }),
        ),
      })),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
    expect(gitAdapter.createCommit).not.toHaveBeenCalled()
  })

  it('should not change cached entries if the migration changes the snapshot', async () => {
    const gitAdapter = createGitAdapter([ada, book])
    const client = await createClient(gitAdapter)

    await client.migrate(branch, (snapshot) => {
      ;(snapshot.entries.get('ada') as Entry).data = { name: 'Changed' }
      return { entries: [] }
    })
    const result = await client.postGraphQL(branch, {
      query: '{ Author(id: "ada") { name } }',
    })

    expect(result.data).toEqual({ Author: { name: 'Ada' } })
  })
})

describe('Removing unknown fields', () => {
  it('should remove data under unknown keys and unknown metadata in a single commit', async () => {
    const unionSchema = `directive @Entry on OBJECT

type Page @Entry {
    id: ID!
    title: String
    sections: [Section!]
    author: Author
}

type Author @Entry {
    id: ID!
}

union Section = Hero | Text

type Hero {
    headline: String
}

type Text {
    body: String
}`
    const page: Entry = {
      id: 'page',
      metadata: { type: 'Page', referencedBy: [] } as Entry['metadata'],
      data: {
        title: 'Home',
        legacy: 'old',
        sections: [
          { Hero: { headline: 'Hi', subline: 'old' } },
          { Text: { body: 'Text' } },
        ],
        author: { id: 'ada', name: 'old' },
      },
    }
    const author: Entry = { id: 'ada', metadata: { type: 'Author' }, data: {} }
    const gitAdapter = createGitAdapter([page, author], unionSchema)
    const client = await createClient(gitAdapter)

    const result = await client.removeUnknownFields(branch)

    expect(result).toEqual({ ref: newHash })
    expect(gitAdapter.createCommit).toHaveBeenCalledWith({
      ref: branch,
      parentSha: headHash,
      message: 'Remove unknown fields',
      entries: [
        {
          id: 'page',
          metadata: { type: 'Page' },
          data: {
            title: 'Home',
            sections: [
              { Hero: { headline: 'Hi' } },
              { Text: { body: 'Text' } },
            ],
            author: { id: 'ada' },
          },
          deletion: false,
        },
      ],
    })
  })

  it('should not commit if no entry has unknown fields', async () => {
    const gitAdapter = createGitAdapter([ada, book])
    const client = await createClient(gitAdapter)

    const result = await client.removeUnknownFields(branch, {
      message: 'Clean up',
    })

    expect(result).toEqual({ ref: headHash })
    expect(gitAdapter.createCommit).not.toHaveBeenCalled()
  })
})
