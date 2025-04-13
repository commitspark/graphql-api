import { Entry, GitAdapter } from '@commitspark/git-adapter'
import { GraphQLError } from 'graphql'

export class PersistenceService {
  public async getTypeById(
    gitAdapter: GitAdapter,
    commitHash: string,
    id: string,
  ): Promise<string> {
    const allEntries = await gitAdapter.getEntries(commitHash)
    const requestedEntry = allEntries.find((entry: Entry) => entry.id === id)
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
  ): Promise<Entry> {
    const allEntries = await gitAdapter.getEntries(commitHash)
    const requestedEntry = allEntries.find((entry: Entry) => entry.id === id)
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
  ): Promise<Entry[]> {
    const allEntries = await gitAdapter.getEntries(commitHash)
    return allEntries.filter((entry: Entry) => entry.metadata.type === type)
  }

  public async findByTypeId(
    gitAdapter: GitAdapter,
    commitHash: string,
    type: string,
    id: string,
  ): Promise<Entry> {
    const allEntries = await gitAdapter.getEntries(commitHash)
    const requestedEntry = allEntries.find(
      (entry: Entry) => entry.id === id && entry.metadata.type === type,
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
