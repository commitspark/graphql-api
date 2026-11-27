import { RequestContext } from '../client.ts'
import { callGitAdapter } from '../persistence/git-adapter-call.ts'
import { compareEntryIds } from '../persistence/entry-order.ts'

export enum EntryChangeKind {
  /**
   * The entry exists only at the newer commit.
   */
  ADDED = 'ADDED',
  /**
   * The entry exists at both commits with different content.
   */
  MODIFIED = 'MODIFIED',
  /**
   * The entry exists only at the older commit.
   */
  DELETED = 'DELETED',
}

export interface EntryChange {
  id: string
  kind: EntryChangeKind
  /**
   * Entry type at the newer commit; `null` if the entry was deleted.
   */
  type: string | null
  /**
   * Entry type at the older commit; `null` if the entry was added.
   */
  previousType: string | null
}

export interface EntryChangesResult {
  /**
   * Commit hash that `fromRef` resolved to.
   */
  from: string
  /**
   * Commit hash that `toRef` resolved to.
   */
  to: string
  /**
   * Changed entries, ordered by entry ID.
   */
  entries: EntryChange[]
}

/**
 * Compares the entries of the commit `fromRef` resolves to with those of the current commit of the context. Only the
 * content of the two commits is compared, not the history between them.
 */
export async function getEntryChanges(
  context: RequestContext,
  fromRef: string,
): Promise<EntryChangesResult> {
  const from = await callGitAdapter(() =>
    context.gitAdapter.getLatestCommitHash(fromRef),
  )
  const to = context.getCurrentHash()
  const [fromRecord, toRecord] = await Promise.all([
    context.repositoryCache.getEntriesRecord(context, from),
    context.repositoryCache.getEntriesRecord(context, to),
  ])

  const entries: EntryChange[] = []
  for (const [id, fromEntry] of fromRecord.byId) {
    const toEntry = toRecord.byId.get(id)
    if (toEntry === undefined) {
      entries.push({
        id,
        kind: EntryChangeKind.DELETED,
        type: null,
        previousType: fromEntry.metadata.type,
      })
    } else if (fromRecord.hashById.get(id) !== toRecord.hashById.get(id)) {
      entries.push({
        id,
        kind: EntryChangeKind.MODIFIED,
        type: toEntry.metadata.type,
        previousType: fromEntry.metadata.type,
      })
    }
  }
  for (const [id, toEntry] of toRecord.byId) {
    if (!fromRecord.byId.has(id)) {
      entries.push({
        id,
        kind: EntryChangeKind.ADDED,
        type: toEntry.metadata.type,
        previousType: null,
      })
    }
  }

  return {
    from,
    to,
    entries: entries.sort((a, b) => compareEntryIds(a.id, b.id)),
  }
}
