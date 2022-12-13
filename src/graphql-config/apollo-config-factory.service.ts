import { makeExecutableSchema } from '@graphql-tools/schema'
import { SchemaGeneratorService } from './schema-generator.service'
import { ApolloContext } from '../app/api.service'
import { ApolloServerOptions } from '@apollo/server'

export class ApolloConfigFactoryService {
  constructor(private readonly schemaGenerator: SchemaGeneratorService) {}

  async createGqlOptions(
    context: ApolloContext,
  ): Promise<ApolloServerOptions<ApolloContext>> {
    const schemaDefinition = await this.schemaGenerator.generateSchema(context)
    const schema = makeExecutableSchema(schemaDefinition)

    return {
      schema: schema,
    } as ApolloServerOptions<ApolloContext>
  }
}
