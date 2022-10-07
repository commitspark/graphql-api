import { GitAdapter } from 'contentlab-git-adapter'
import { ApiService } from './app/api.service'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app/app.module'

export interface GitAdapterOptions<GitRepositoryOptions> {
  adapterModuleClass: Type
  adapterServiceClass: Type<GitAdapter>
  repositoryOptions: GitRepositoryOptions
}

export interface Type<T = any> extends Function {
  new (...args: any[]): T
}

export async function getApiService(): Promise<ApiService> {
  const appContext = await NestFactory.createApplicationContext(AppModule)
  return appContext.get(ApiService)
}
