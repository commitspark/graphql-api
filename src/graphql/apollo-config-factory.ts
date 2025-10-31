import { makeExecutableSchema } from '@graphql-tools/schema'
import { generateSchema } from './schema-generator'
import { ApolloContext } from '../app/api.service'
import { ApolloServerOptions } from '@apollo/server'
import { ApolloServerPluginUsageReportingDisabled } from '@apollo/server/plugin/disabled'

export async function createApolloConfig(
  context: ApolloContext,
): Promise<ApolloServerOptions<ApolloContext>> {
  const schemaDefinition = await generateSchema(context)
  const schema = makeExecutableSchema(schemaDefinition)

  return {
    schema: schema,
    plugins: [ApolloServerPluginUsageReportingDisabled()],
  } as ApolloServerOptions<ApolloContext>
}
