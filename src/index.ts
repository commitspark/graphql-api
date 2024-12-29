import { ApiService, GraphQLResponse, SchemaResponse } from './app/api.service'
import { apiService } from './container'

export { ApiService, GraphQLResponse, SchemaResponse }

export async function getApiService(): Promise<ApiService> {
  return apiService
}
