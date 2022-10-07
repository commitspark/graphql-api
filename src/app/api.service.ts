import { ApolloConfigFactoryService } from '../graphql-config/apollo-config-factory.service'
import { SchemaGeneratorService } from '../graphql-config/schema-generator.service'
import { UnknownElementException } from '@nestjs/core/errors/exceptions/unknown-element.exception'
import { GitAdapterFactoryService } from '../git/git-adapter-factory.service'
import { GraphQLFormattedError } from 'graphql'
import { Injectable } from '@nestjs/common'
import { ApolloServerBase } from 'apollo-server-core'
import { Config } from 'apollo-server-core/src/types'
import { GitAdapterOptions } from '../index'
import { GitAdapter, GitRepositoryOptions } from 'contentlab-git-adapter'

@Injectable()
export class ApiService {
  constructor(
    private readonly apolloConfigFactory: ApolloConfigFactoryService,
    private readonly schemaGenerator: SchemaGeneratorService,
    private readonly adapterFactory: GitAdapterFactoryService,
  ) {}

  async postGraphQL(
    gitAdapterOptions: GitAdapterOptions<GitRepositoryOptions>,
    ref: string,
    body: any,
  ): Promise<GraphQLResponse> {
    const gitAdapter = await this.adapterFactory.createGitAdapter(
      gitAdapterOptions,
    )
    let currentRef = await gitAdapter.getLatestCommitSha(ref)
    const contextGenerator = (): ApolloContext => ({
      branch: ref,
      gitAdapter: gitAdapter,
      getCurrentRef(): string {
        return currentRef
      },
      setCurrentRef(refArg: string) {
        currentRef = refArg
      },
    })

    const apolloDriverConfig: Config =
      await this.apolloConfigFactory.createGqlOptions(contextGenerator())

    const apolloServer = new ApolloServerBase({
      ...apolloDriverConfig,
      context: contextGenerator,
    })

    const result = await apolloServer.executeOperation(body)

    return {
      ref: contextGenerator().getCurrentRef(),
      data: result.data,
      errors: result.errors,
    }
  }

  async getSchema(
    gitAdapterOptions: GitAdapterOptions<GitRepositoryOptions>,
    ref: string,
  ): Promise<SchemaResponse> {
    const gitAdapter = await this.adapterFactory.createGitAdapter(
      gitAdapterOptions,
    )
    let currentRef = await gitAdapter.getLatestCommitSha(ref)
    const contextGenerator = () =>
      ({
        branch: ref,
        gitAdapter: gitAdapter,
        getCurrentRef(): string {
          return currentRef
        },
        setCurrentRef(refArg: string) {
          currentRef = refArg
        },
      } as ApolloContext)

    const typeDefinitionStrings = (
      await this.schemaGenerator.generateSchema(contextGenerator())
    ).typeDefs
    if (!Array.isArray(typeDefinitionStrings)) {
      throw new UnknownElementException()
    }

    return {
      ref: contextGenerator().getCurrentRef(),
      data: typeDefinitionStrings.join('\n'),
    }
  }
}

export interface ApolloContext {
  branch: string
  gitAdapter: GitAdapter
  getCurrentRef(): string
  setCurrentRef(sha: string): void
}

export interface GraphQLResponse {
  ref: string
  data?: Record<string, any> | null
  errors: ReadonlyArray<GraphQLFormattedError>
}

export interface SchemaResponse {
  ref: string
  data: string
}
