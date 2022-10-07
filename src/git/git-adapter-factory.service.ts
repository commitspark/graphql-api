import { Injectable } from '@nestjs/common'
import { GitAdapter, GitRepositoryOptions } from 'contentlab-git-adapter'
import { LazyModuleLoader } from '@nestjs/core'
import { GitAdapterOptions } from '../index'

@Injectable()
export class GitAdapterFactoryService {
  constructor(private readonly lazyModuleLoader: LazyModuleLoader) {}

  public async createGitAdapter(
    options: GitAdapterOptions<GitRepositoryOptions>,
  ): Promise<GitAdapter> {
    const moduleRef = await this.lazyModuleLoader.load(
      () => options.adapterModuleClass,
    )
    // create new service instance on each call;
    // see https://docs.nestjs.com/fundamentals/module-ref#resolving-scoped-providers
    const gitAdapter: GitAdapter = await moduleRef.resolve(
      options.adapterServiceClass,
    )
    gitAdapter.setRepositoryOptions(options.repositoryOptions)

    return gitAdapter
  }
}
