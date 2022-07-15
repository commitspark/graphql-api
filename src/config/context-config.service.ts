import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class ContextConfigService {
  private requestContext: IContentlabContext

  constructor(private configService: ConfigService) {}

  public getRequestContext(): IContentlabContext {
    if (!this.requestContext) {
      // fall back to environment variables
      this.requestContext = {
        repositoryHosting: 'gitlab',
        repositoryPath: this.configService.get<string>('GITLAB_PROJECT_PATH'),
        repositoryToken: this.configService.get<string>(
          'GITLAB_PERSONAL_ACCESS_TOKEN',
        ),
      }
    }

    return this.requestContext
  }

  public setRequestContext(requestContext: IContentlabContext) {
    if (this.requestContext !== undefined) {
      throw new Error('Request context must only be set once before reading')
    }

    this.requestContext = requestContext
  }
}

export interface IContentlabContext {
  repositoryHosting: string
  repositoryPath: string
  repositoryToken: string
}
