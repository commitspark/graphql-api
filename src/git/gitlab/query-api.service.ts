import { Injectable, NotFoundException } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { map } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'
import { GraphqlQueryFactoryService } from './graphql-query-factory.service'
import { ContentEntry } from '../model/content-entry'
import { parse } from 'yaml'
import { setupCache } from 'axios-cache-adapter'
import { AxiosRequestConfig } from 'axios'
import { ContextConfigService } from '../../config/context-config.service'

@Injectable()
export class QueryApiService {
  static readonly ENTRY_EXTENSION = '.yaml'
  static readonly ENTRY_FOLDER_NAME = 'entries'
  static readonly SCHEMA_FOLDER_NAME = 'schema'
  static readonly SCHEMA_FILENAME = 'schema.graphql'
  static readonly QUERY_CACHE_SECONDS = 10 * 60

  private readonly axiosCache

  constructor(
    private readonly httpService: HttpService,
    private readonly contextConfig: ContextConfigService,
    private readonly graphqlQueryFactory: GraphqlQueryFactoryService,
  ) {
    this.axiosCache = setupCache({
      maxAge: QueryApiService.QUERY_CACHE_SECONDS * 1000, // milliseconds
      exclude: {
        methods: [], // HTTP methods not to cache
      },
    })
  }

  public async getContentEntries(ref: string): Promise<ContentEntry[]> {
    const project = this.contextConfig.getRequestContext().repositoryPath

    const queryBlobs = this.graphqlQueryFactory.createBlobQuery(
      project,
      ref,
      QueryApiService.ENTRY_FOLDER_NAME,
    )
    const allFilePaths: string[] = await firstValueFrom(
      this.httpService
        .post(
          'https://gitlab.com/api/graphql',
          {
            query: queryBlobs,
          },
          this.getAxiosConfig(),
        )
        .pipe(
          map(
            (response) =>
              response.data.data.project.repository.tree.blobs.nodes,
          ),
        )
        .pipe(map((blobs) => blobs.map((blob) => blob.path))),
    )

    const entryFilePaths = allFilePaths.filter((filename: string) =>
      filename.endsWith(QueryApiService.ENTRY_EXTENSION),
    )

    const queryContent = this.graphqlQueryFactory.createBlobContentQuery(
      project,
      ref,
      entryFilePaths,
    )
    const content = await firstValueFrom(
      this.httpService
        .post(
          'https://gitlab.com/api/graphql',
          {
            query: queryContent,
          },
          this.getAxiosConfig(),
        )
        .pipe(
          map((response) => response.data.data.project.repository.blobs.edges),
        ),
    )

    const extensionLength = QueryApiService.ENTRY_EXTENSION.length
    return content
      .map((edge) => edge.node)
      .map((node) => {
        const content = parse(node.rawBlob)
        const id = node.path.substring(
          QueryApiService.ENTRY_FOLDER_NAME.length + 1, // trailing slash folder separator
          node.path.length - extensionLength,
        )
        return new ContentEntry(id, content.metadata, content.data)
      })
  }

  public async getSchema(ref: string): Promise<string> {
    const project = this.contextConfig.getRequestContext().repositoryPath
    const schemaFilePath = `${QueryApiService.SCHEMA_FOLDER_NAME}/${QueryApiService.SCHEMA_FILENAME}`

    const queryContent = this.graphqlQueryFactory.createBlobContentQuery(
      project,
      ref,
      [schemaFilePath],
    )
    const response = await firstValueFrom(
      this.httpService
        .post(
          'https://gitlab.com/api/graphql',
          {
            query: queryContent,
          },
          this.getAxiosConfig(),
        )
        .pipe(
          map((response) => response.data.data.project.repository.blobs.edges),
        ),
    )

    if (response.length === 0) {
      throw new NotFoundException(
        `"${schemaFilePath}" not found in Git repository "${project}" in branch "${ref}"`,
      )
    }

    return response[0].node.rawBlob
  }

  public async getLatestCommitSha(ref: string): Promise<string> {
    const project = this.contextConfig.getRequestContext().repositoryPath
    const token = this.contextConfig.getRequestContext().repositoryToken
    const queryLatestCommit = this.graphqlQueryFactory.createLatestCommitQuery(
      project,
      ref,
    )

    const response = await firstValueFrom(
      this.httpService.post(
        'https://gitlab.com/api/graphql',
        {
          query: queryLatestCommit,
        },
        {
          // must not use cache here, so we always get the branch's current head
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
      ),
    )

    const lastCommit = response.data.data.project.repository.tree.lastCommit
    if (!lastCommit) {
      throw new NotFoundException(`No commit found for branch "${ref}"`)
    }

    return lastCommit.sha
  }

  private getAxiosConfig(): AxiosRequestConfig {
    const token = this.contextConfig.getRequestContext().repositoryToken
    return {
      adapter: this.axiosCache.adapter,
      headers: {
        authorization: `Bearer ${token}`,
      },
    }
  }
}
