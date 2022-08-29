import { ContentEntry } from './content-entry'
import { ContentEntryMetadata } from './content-entry-metadata'

export class ContentEntryDraft extends ContentEntry {
  readonly deletion: boolean

  constructor(
    id: string,
    metadata: ContentEntryMetadata,
    data: Record<string, unknown>,
    deletion: boolean,
  ) {
    super(id, metadata, data)
    this.deletion = deletion
  }
}
