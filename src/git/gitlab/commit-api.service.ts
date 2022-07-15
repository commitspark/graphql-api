import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { GraphqlQueryFactoryService } from './graphql-query-factory.service'
import { CommitDraft } from '../model/commit-draft'
import { firstValueFrom } from 'rxjs'
import { QueryApiService } from './query-api.service'
import { Commit } from '../model/commit'
import { ContentEntriesToActionsConverterService } from './content-entries-to-actions-converter.service'
import { ActionModel } from './action.model'
import { ContextConfigService } from '../../config/context-config.service'

@Injectable()
export class CommitApiService {
  constructor(
    private httpService: HttpService,
    private contextConfig: ContextConfigService,
    private graphqlQueryFactory: GraphqlQueryFactoryService,
    private queryApi: QueryApiService,
    private contentEntryToActionConverterService: ContentEntriesToActionsConverterService,
  ) {}

  public async createCommit(commitDraft: CommitDraft): Promise<Commit> {
    const project = this.contextConfig.getRequestContext().repositoryPath
    const token = this.contextConfig.getRequestContext().repositoryToken

    // assumes branch/ref already exists
    const existingContentEntries = await this.queryApi.getContentEntries(
      commitDraft.ref,
    )
    const existingIdMap = new Map<string, boolean>()
    existingContentEntries.forEach((entry) => existingIdMap.set(entry.id, true))

    const actions: ActionModel[] =
      this.contentEntryToActionConverterService.convert(
        commitDraft.contentEntries,
        existingIdMap,
        commitDraft.parentSha,
      )

    const mutateCommit = this.graphqlQueryFactory.createCommitMutation()
    const response: any = await firstValueFrom(
      this.httpService.post(
        'https://gitlab.com/api/graphql',
        {
          query: mutateCommit,
          variables: {
            actions,
            branch: commitDraft.ref, // if `ref` is a hash and not a branch, commits are rejected by GitLab
            message: commitDraft.message ?? '-',
            projectPath: project,
          },
        },
        {
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
      ),
    )

    const mutationResult = response.data.data.commitCreate

    if (mutationResult.errors.length > 0) {
      throw new Error(mutationResult.errors)
    }

    return new Commit(mutationResult.commit.sha)
  }
}
