import { GraphQLError } from 'graphql'
import { ErrorCode as GitAdapterErrorCode } from '@commitspark/git-adapter'
import { ErrorCode as SearchAdapterErrorCode } from '@commitspark/search-adapter'

export const enum ErrorCode {
  BAD_USER_INPUT = 'BAD_USER_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REPOSITORY_DATA = 'BAD_REPOSITORY_DATA',
  BAD_SCHEMA = 'BAD_SCHEMA',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  IN_USE = 'IN_USE',
}

export interface ErrorMetadata {
  typeName?: string
  fieldName?: string
  fieldValue?: unknown
  argumentName?: string
  argumentValue?: unknown
  schema?: string
}

export const createError = (
  message: string,
  code: ErrorCode | GitAdapterErrorCode | SearchAdapterErrorCode,
  metaData: ErrorMetadata,
): GraphQLError => {
  const serializedFieldValue =
    typeof metaData.fieldValue === 'object' ||
    Array.isArray(metaData.fieldValue)
      ? JSON.stringify(metaData.fieldValue)
      : metaData.fieldValue
  const updatedMetaData = { ...metaData }
  if (serializedFieldValue !== undefined) {
    updatedMetaData.fieldValue = serializedFieldValue
  }

  return new GraphQLError(message, {
    extensions: {
      code: code,
      commitspark: updatedMetaData,
    },
  })
}
