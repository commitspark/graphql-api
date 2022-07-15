import { ApolloConfigFactoryService } from '../graphql-config/apollo-config-factory.service'
import { SchemaGeneratorService } from '../graphql-config/schema-generator.service'
import { UnknownElementException } from '@nestjs/core/errors/exceptions/unknown-element.exception'
import { QueryApiService } from '../git/gitlab/query-api.service'
import { GraphQLFormattedError } from 'graphql'
import { Injectable } from '@nestjs/common'
import { ApolloServerBase } from 'apollo-server-core'
import { Config } from 'apollo-server-core/src/types'

@Injectable()
export class ApiService {
  constructor(
    private readonly apolloConfigFactory: ApolloConfigFactoryService,
    private readonly schemaGenerator: SchemaGeneratorService,
    private readonly queryApi: QueryApiService,
  ) {}

  async postGraphQL(ref: string, body: any): Promise<GraphQLResponse> {
    let currentRef = await this.queryApi.getLatestCommitSha(ref)
    const contextGenerator = () =>
      ({
        branch: ref,
        getCurrentRef(): string {
          return currentRef
        },
        setCurrentRef(refArg: string) {
          currentRef = refArg
        },
      } as IApolloContext)

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

  async getSchema(ref: string): Promise<SchemaResponse> {
    let currentRef = await this.queryApi.getLatestCommitSha(ref)
    const contextGenerator = () =>
      ({
        branch: ref,
        getCurrentRef(): string {
          return currentRef
        },
        setCurrentRef(refArg: string) {
          currentRef = refArg
        },
      } as IApolloContext)

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

export interface IApolloContext {
  branch: string
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
