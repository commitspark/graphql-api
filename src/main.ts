import { HttpStatus } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { APIGatewayProxyEventV2, Callback, Context, Handler } from 'aws-lambda'
import { AppModule } from './app/app.module'
import { ApiService } from './app/api.service'

export const graphql: Handler = async (
  event: APIGatewayProxyEventV2,
  context: Context,
  callback: Callback,
) => {
  const appContext = await NestFactory.createApplicationContext(AppModule)
  const api = appContext.get(ApiService)
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
  const appContext = await NestFactory.createApplicationContext(AppModule)
  const api = appContext.get(ApiService)
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
