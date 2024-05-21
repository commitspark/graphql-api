import { ContentEntry, GitAdapter } from '@commitspark/git-adapter'
import { GraphQLError } from 'graphql/error/GraphQLError'

export class PersistenceService {
  public async getTypeById(
    gitAdapter: GitAdapter,
    commitHash: string,
    id: string,
  ): Promise<string> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    const requestedEntry = allEntries.filter(
      (contentEntry: ContentEntry) => contentEntry.id === id,
    )[0]
    if (requestedEntry === undefined) {
      throw new Error(`Not found: ${id}`)
    }

    return requestedEntry.metadata.type
  }

  public async findById(
    gitAdapter: GitAdapter,
    commitHash: string,
    id: string,
  ): Promise<Entry> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    const requestedEntry = allEntries.find(
      (contentEntry: ContentEntry) => contentEntry.id === id,
    )
    if (requestedEntry === undefined) {
      throw new Error(`Not found: ${id}`)
    }

    return { ...requestedEntry.data, id: id }
  }

  public async findByType(
    gitAdapter: GitAdapter,
    commitHash: string,
    type: string,
  ): Promise<Entry[]> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    return allEntries
      .filter(
        (contentEntry: ContentEntry) => contentEntry.metadata.type === type,
      )
      .map((value) => ({ ...value.data, id: value.id }))
  }

  public async findByTypeId(
    gitAdapter: GitAdapter,
    commitHash: string,
    type: string,
    id: string,
  ): Promise<Entry> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    const requestedEntry = allEntries.find(
      (contentEntry: ContentEntry) => contentEntry.id === id,
    )
    if (requestedEntry === undefined || requestedEntry.metadata.type !== type) {
      throw new Error(`Not found: ${type}, ${id}`)
    }

    return { ...requestedEntry.data, id: id }
  }

  public async createType(
    gitAdapter: GitAdapter,
    branch: string,
    commitHash: string,
    typeName: string,
    id: string,
    data: Entry,
    message: string,
  ): Promise<CommitResult> {
    // TODO expose regex publicly to allow reuse
    const regex = /^[a-zA-Z0-9\-_]{1,250}$/
    if (!id.match(regex)) {
      throw new GraphQLError(`"id" does not match regex "${regex}"`, {
        extensions: {
          code: 'BAD_USER_INPUT',
          argumentName: 'id',
        },
      })
    }

    const commit = await gitAdapter.createCommit({
      ref: branch,
      parentSha: commitHash,
      contentEntries: [
        {
          id: id,
          metadata: {
            type: typeName,
          },
          data: data,
          deletion: false,
        },
      ],
      message: message,
    })

    return {
      ref: commit.ref,
    }
  }

  public async updateByTypeId(
    gitAdapter: GitAdapter,
    branch: string,
    commitHash: string,
    type: string,
    id: string,
    data: Entry,
    message: string,
  ): Promise<CommitResult> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    const requestedEntry = allEntries.find(
      (contentEntry: ContentEntry) => contentEntry.id === id,
    )
    if (requestedEntry === undefined || requestedEntry.metadata.type !== type) {
      throw new Error(`Not found: ${type}, ${id}`)
    }

    const newData: Entry = { ...requestedEntry.data, ...data }

    const commit = await gitAdapter.createCommit({
      ref: branch,
      parentSha: commitHash,
      contentEntries: [
        {
          id: id,
          metadata: requestedEntry.metadata,
          data: newData,
          deletion: false,
        },
      ],
      message: message,
    })

    return {
      ref: commit.ref,
    }
  }

  public async deleteByTypeId(
    gitAdapter: GitAdapter,
    branch: string,
    commitHash: string,
    type: string,
    id: string,
    message: string,
  ): Promise<CommitResult> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    const requestedEntry = allEntries.find(
      (contentEntry: ContentEntry) => contentEntry.id === id,
    )
    if (requestedEntry === undefined || requestedEntry.metadata.type !== type) {
      throw new Error(`Not found: ${type}, ${id}`)
    }

    const commit = await gitAdapter.createCommit({
      ref: branch,
      parentSha: commitHash,
      contentEntries: [
        {
          id: id,
          metadata: requestedEntry.metadata,
          data: {},
          deletion: true,
        },
      ],
      message: message,
    })

    return {
      ref: commit.ref,
    }
  }
}

export interface CommitResult {
  ref: string // commit sha
}

export type Entry = Record<string, unknown>
