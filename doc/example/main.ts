import { HttpStatus } from '@nestjs/common'
import { APIGatewayProxyEventV2, Callback, Context, Handler } from 'aws-lambda'
import { getApiService } from '../../src'
import {
  GitLabAdapterModule,
  GitLabAdapterService,
  GitLabRepositoryOptions,
} from 'contentlab-git-adapter-gitlab'

export const graphql: Handler = async (
  event: APIGatewayProxyEventV2,
  context: Context,
  callback: Callback,
) => {
  const api = await getApiService<GitLabRepositoryOptions>({
    adapterModuleClass: GitLabAdapterModule,
    adapterServiceClass: GitLabAdapterService,
    repositoryOptions: {
      projectPath: process.env.GITLAB_PROJECT_PATH,
      token: process.env.GITLAB_PERSONAL_ACCESS_TOKEN,
    },
  })
  const response = await api.postGraphQL(
    event.pathParameters['ref'],
    JSON.parse(event.body),
  )

  const body = {
    data: response.data,
    errors: response.errors,
  }
  return {
    body: JSON.stringify(body),
    statusCode: HttpStatus.OK,
    headers: {
      'content-type': 'application/graphql+json',
      'X-Ref': response.ref,
    },
  }
}

export const schema: Handler = async (
  event: APIGatewayProxyEventV2,
  context: Context,
  callback: Callback,
) => {
  const api = await getApiService<GitLabRepositoryOptions>({
    adapterModuleClass: GitLabAdapterModule,
    adapterServiceClass: GitLabAdapterService,
    repositoryOptions: {
      projectPath: process.env.GITLAB_PROJECT_PATH,
      token: process.env.GITLAB_PERSONAL_ACCESS_TOKEN,
    },
  })
  const response = await api.getSchema(event.pathParameters['ref'])

  return {
    body: response.data,
    statusCode: HttpStatus.OK,
    headers: {
      'content-type': 'application/graphql+json',
      'X-Ref': response.ref,
    },
  }
}
