import { ActionModel } from './action.model'
import { ContentEntryDraft } from '../model/content-entry-draft'
import { Injectable } from '@nestjs/common'
import { stringify } from 'yaml'
import { QueryApiService } from './query-api.service'

@Injectable()
export class ContentEntriesToActionsConverterService {
  convert(
    contentEntries: ContentEntryDraft[],
    existingIdMap: Map<string, boolean>,
    parentSha: string,
  ): ActionModel[] {
    const actions: ActionModel[] = []
    contentEntries.forEach((contentEntry) => {
      let operation: string
      if (contentEntry.deletion) {
        operation = 'DELETE'
      } else if (existingIdMap.has(contentEntry.id)) {
        operation = 'UPDATE'
      } else {
        operation = 'CREATE'
      }
      actions.push(
        new ActionModel(
          operation,
          stringify({
            metadata: contentEntry.metadata,
            data: contentEntry.data,
          }),
          `${QueryApiService.ENTRY_FOLDER_NAME}/${contentEntry.id}${QueryApiService.ENTRY_EXTENSION}`,
          parentSha,
        ),
      )
    })
    return actions
  }
}
