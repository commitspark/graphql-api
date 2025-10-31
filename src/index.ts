import {
  getSchema,
  GraphQLResponse,
  postGraphQL,
  SchemaResponse,
} from './app/api.service'

interface Client {
  postGraphQL: typeof postGraphQL
  getSchema: typeof getSchema
}

export { Client, GraphQLResponse, SchemaResponse }

export async function createClient(): Promise<Client> {
  return { postGraphQL, getSchema }
}
