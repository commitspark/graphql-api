import { ContentEntry } from './content-entry'
import { ContentEntryMetadata } from './content-entry-metadata'
import { Entry } from '../../persistence/persistence.service'

export class ContentEntryDraft extends ContentEntry {
  readonly deletion: boolean

  constructor(
    id: string,
    metadata: ContentEntryMetadata,
    data: Entry,
    deletion: boolean,
  ) {
    super(id, metadata, data)
    this.deletion = deletion
  }
}
