import { ApiService } from './app/api.service'
import { apiService } from './container'

export { ApiService }

export async function getApiService(): Promise<ApiService> {
  return apiService
}
