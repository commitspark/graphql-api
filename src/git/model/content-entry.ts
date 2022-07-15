import { ContentEntryMetadata } from './content-entry-metadata'
import { Entry } from '../../persistence/persistence.service'

export class ContentEntry {
  readonly id: string
  readonly metadata: ContentEntryMetadata
  readonly data: Entry

  constructor(id: string, metadata: ContentEntryMetadata, data: Entry) {
    this.id = id
    this.metadata = metadata
    this.data = data
  }
}
