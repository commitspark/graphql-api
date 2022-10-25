import { v4 as uuidv4 } from 'uuid'
import { ContentEntry, GitAdapter } from 'contentlab-git-adapter'

export class PersistenceService {
  constructor() {}

  public async getTypeById(
    gitAdapter: GitAdapter,
    commitHash: string,
    id: ID,
  ): Promise<string> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    const requestedEntry = allEntries.filter(
      (contentEntry: ContentEntry) => contentEntry.id === (id as string),
    )[0]
    if (requestedEntry === undefined) {
      throw new Error(`Not found: ${id}`)
    }

    return requestedEntry.metadata.type
  }

  public async findById(
    gitAdapter: GitAdapter,
    commitHash: string,
    id: ID,
  ): Promise<Entry> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    const requestedEntry = allEntries.filter(
      (contentEntry: ContentEntry) => contentEntry.id === (id as string),
    )[0]
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
    id: ID,
  ): Promise<Entry> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    const requestedEntry = allEntries.filter(
      (contentEntry: ContentEntry) => contentEntry.id === (id as string),
    )[0]
    if (requestedEntry === undefined || requestedEntry.metadata.type !== type) {
      throw new Error(`Not found: ${type}, ${id}`)
    }

    return { ...requestedEntry.data, id: id }
  }

  public async createType(
    gitAdapter: GitAdapter,
    ref: string,
    type: string,
    data: Entry,
    message: string,
  ): Promise<CommitResult> {
    const id = uuidv4()
    const commit = await gitAdapter.createCommit({
      ref: ref,
      parentSha: undefined,
      contentEntries: [
        {
          id: id,
          data: data,
          metadata: {
            type: type,
          },
          deletion: false,
        },
      ],
      message: message,
    })

    return {
      id,
      ref: commit.ref,
    }
  }

  public async updateByTypeId(
    gitAdapter: GitAdapter,
    branch: string,
    commitHash: string,
    type: string,
    id: ID,
    data: Entry,
    message: string,
  ): Promise<CommitResult> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    const requestedEntry = allEntries.filter(
      (contentEntry: ContentEntry) => contentEntry.id === (id as string),
    )[0]
    if (requestedEntry === undefined || requestedEntry.metadata.type !== type) {
      throw new Error(`Not found: ${type}, ${id}`)
    }

    const newData: Entry = { ...requestedEntry.data, ...data }

    const commit = await gitAdapter.createCommit({
      ref: branch,
      parentSha: undefined,
      contentEntries: [
        {
          id: id,
          data: newData,
          metadata: requestedEntry.metadata,
          deletion: false,
        },
      ],
      message: message,
    })

    return {
      id,
      ref: commit.ref,
    }
  }

  public async deleteByTypeId(
    gitAdapter: GitAdapter,
    branch: string,
    commitHash: string,
    type: string,
    id: ID,
    message: string,
  ): Promise<CommitResult> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    const requestedEntry = allEntries.filter(
      (contentEntry: ContentEntry) => contentEntry.id === (id as string),
    )[0]
    if (requestedEntry === undefined || requestedEntry.metadata.type !== type) {
      throw new Error(`Not found: ${type}, ${id}`)
    }

    const commit = await gitAdapter.createCommit({
      ref: branch,
      parentSha: undefined,
      contentEntries: [
        {
          id: id,
          data: {},
          metadata: requestedEntry.metadata,
          deletion: true,
        },
      ],
      message: message,
    })

    return {
      id,
      ref: commit.ref,
    }
  }
}

export interface CommitResult {
  id: ID
  ref: string // commit sha
}

export type ID = string

export type Entry = Record<string, unknown>
