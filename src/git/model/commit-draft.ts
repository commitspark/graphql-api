import { ContentEntryDraft } from './content-entry-draft'

export class CommitDraft {
  readonly ref: string
  readonly parentSha?: string
  readonly message: string
  readonly contentEntries: ContentEntryDraft[]
}
