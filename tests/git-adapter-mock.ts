import { Entry, GitAdapter } from '@commitspark/git-adapter'
import { any, MockProxy } from 'jest-mock-extended'

// uses serialized entry content as hash, which satisfies the requirement that equal hashes imply equal content
const createContentHash = (entry: Entry): string =>
  JSON.stringify({ metadata: entry.metadata, data: entry.data })

export const mockEntries = (
  gitAdapter: MockProxy<GitAdapter>,
  commitHash: string,
  entries: Entry[],
): void => {
  gitAdapter.getEntryHashes.calledWith(commitHash).mockResolvedValue(
    entries.map((entry) => ({
      id: entry.id,
      hash: createContentHash(entry),
    })),
  )
  gitAdapter.getEntriesByIds
    .calledWith(commitHash, any())
    .mockImplementation(async (_commitHash, ids) =>
      entries.filter((entry) => ids.includes(entry.id)),
    )
}
