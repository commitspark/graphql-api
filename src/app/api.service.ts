import { ApolloConfigFactoryService } from '../graphql-config/apollo-config-factory.service'
import { SchemaGeneratorService } from '../graphql-config/schema-generator.service'
import { GraphQLFormattedError } from 'graphql'
import { ApolloServerBase } from 'apollo-server-core'
import { Config } from 'apollo-server-core/src/types'
import { GitAdapter } from 'contentlab-git-adapter'

export class ApiService {
  constructor(
    private readonly apolloConfigFactory: ApolloConfigFactoryService,
    private readonly schemaGenerator: SchemaGeneratorService,
  ) {}

  async postGraphQL(
    gitAdapter: GitAdapter,
    ref: string,
    body: any,
  ): Promise<GraphQLResponse> {
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
    gitAdapter: GitAdapter,
    ref: string,
  ): Promise<SchemaResponse> {
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
      throw new Error('Unknown element')
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
