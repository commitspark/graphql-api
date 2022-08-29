import { ContentEntryMetadata } from './content-entry-metadata'

export class ContentEntry {
  readonly id: string
  readonly metadata: ContentEntryMetadata
  readonly data: Record<string, unknown>

  constructor(id: string, metadata: ContentEntryMetadata, data: Record<string, unknown>) {
    this.id = id
    this.metadata = metadata
    this.data = data
  }
}
