import { ContentEntry, GitAdapter } from '@commitspark/git-adapter'
import { GraphQLError } from 'graphql/error/GraphQLError'

export class PersistenceService {
  public async getTypeById(
    gitAdapter: GitAdapter,
    commitHash: string,
    id: string,
  ): Promise<string> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    const requestedEntry = allEntries.find(
      (contentEntry: ContentEntry) => contentEntry.id === id,
    )
    if (requestedEntry === undefined) {
      throw new GraphQLError(`Not found: ${id}`, {
        extensions: {
          code: 'NOT_FOUND',
        },
      })
    }

    return requestedEntry.metadata.type
  }

  public async findById(
    gitAdapter: GitAdapter,
    commitHash: string,
    id: string,
  ): Promise<ContentEntry> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    const requestedEntry = allEntries.find(
      (contentEntry: ContentEntry) => contentEntry.id === id,
    )
    if (requestedEntry === undefined) {
      throw new GraphQLError(`Not found: ${id}`, {
        extensions: {
          code: 'NOT_FOUND',
        },
      })
    }

    return requestedEntry
  }

  public async findByType(
    gitAdapter: GitAdapter,
    commitHash: string,
    type: string,
  ): Promise<ContentEntry[]> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    return allEntries.filter(
      (contentEntry: ContentEntry) => contentEntry.metadata.type === type,
    )
  }

  public async findByTypeId(
    gitAdapter: GitAdapter,
    commitHash: string,
    type: string,
    id: string,
  ): Promise<ContentEntry> {
    const allEntries = await gitAdapter.getContentEntries(commitHash)
    const requestedEntry = allEntries.find(
      (contentEntry: ContentEntry) =>
        contentEntry.id === id && contentEntry.metadata.type === type,
    )
    if (requestedEntry === undefined) {
      throw new GraphQLError(
        `No entry of type "${type}" with id "${id}" exists`,
        {
          extensions: {
            code: 'BAD_USER_INPUT',
            argumentName: 'id',
          },
        },
      )
    }

    return requestedEntry
  }
}

export interface CommitResult {
  ref: string // commit sha
}

export type Entry = Record<string, unknown>
