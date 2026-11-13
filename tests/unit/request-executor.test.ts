import { GraphQLError } from 'graphql'
import { ErrorCode } from '../../src/graphql/errors'
import { formatError } from '../../src/graphql/request-executor'

describe('Error formatting', () => {
  it('should set the default code for an error without code', () => {
    const error = new GraphQLError('Unexpected failure.', {
      path: ['data'],
      originalError: new Error('Unexpected failure.'),
    })

    expect(formatError(error, ErrorCode.INTERNAL_ERROR)).toEqual({
      message: 'Unexpected failure.',
      path: ['data'],
      extensions: { code: 'INTERNAL_ERROR' },
    })
  })

  it('should keep the code and other extensions of an error', () => {
    const error = new GraphQLError('Not found.', {
      extensions: { code: 'NOT_FOUND', commitspark: { argumentValue: 'x' } },
    })

    expect(formatError(error, ErrorCode.INTERNAL_ERROR)).toEqual({
      message: 'Not found.',
      extensions: { code: 'NOT_FOUND', commitspark: { argumentValue: 'x' } },
    })
  })
})
