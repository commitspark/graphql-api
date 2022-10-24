import { ApiService } from './app/api.service'
import { app } from './container'

export { ApiService }

export async function getApiService(): Promise<ApiService> {
  return app.api
}
