import { GraphQLError } from 'graphql'
import {
  ErrorCode as AdapterErrorCode,
  GitAdapter,
  GitAdapterError,
} from '@commitspark/git-adapter'

import {
  findById,
  findByType,
  findByTypeId,
  getTypeById,
} from '../../../src/persistence/persistence'

describe('Persistence', () => {
  const commitHash = 'abc123'

  const makeThrowingAdapter = (
    code: AdapterErrorCode,
    message: string,
  ): GitAdapter => {
    return {
      // Only the method used by persistence.ts needs to be mocked
      getEntries: jest.fn(async () => {
        throw new GitAdapterError(code, message)
      }),
    } as unknown as GitAdapter
  }

  it('should map adapter errors in `findById` to GraphQLError', async () => {
    const errorMessage = 'not found'
    const adapter = makeThrowingAdapter(
      AdapterErrorCode.NOT_FOUND,
      errorMessage,
    )

    try {
      await findById(adapter, commitHash, 'some-id')
      fail('Expected findById to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(GraphQLError)
      const gqlError = error as GraphQLError
      expect(gqlError.message).toBe(errorMessage)
      expect(gqlError.extensions?.code).toBe(AdapterErrorCode.NOT_FOUND)
    }
  })

  test('should map adapter errors in `findByType` to GraphQLError', async () => {
    const errorMessage = 'forbidden'
    const adapter = makeThrowingAdapter(
      AdapterErrorCode.FORBIDDEN,
      errorMessage,
    )

    try {
      await findByType(adapter, commitHash, 'AnyType')
      fail('Expected findByType to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(GraphQLError)
      const gqlError = error as GraphQLError
      expect(gqlError.message).toBe(errorMessage)
      expect(gqlError.extensions?.code).toBe(AdapterErrorCode.FORBIDDEN)
    }
  })

  it('should map adapter errors in `findByTypeId` to GraphQLError', async () => {
    const errorMessage = 'internal error'
    const adapter = makeThrowingAdapter(
      AdapterErrorCode.INTERNAL_ERROR,
      errorMessage,
    )

    try {
      await findByTypeId(adapter, commitHash, 'AnyType', 'some-id')
      fail('Expected findByTypeId to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(GraphQLError)
      const gqlError = error as GraphQLError
      expect(gqlError.message).toBe(errorMessage)
      expect(gqlError.extensions?.code).toBe(AdapterErrorCode.INTERNAL_ERROR)
    }
  })

  it('should map adapter errors in `getTypeById` to GraphQLError', async () => {
    const errorMessage = 'unauthorized'
    const adapter = makeThrowingAdapter(
      AdapterErrorCode.UNAUTHORIZED,
      errorMessage,
    )

    try {
      await getTypeById(adapter, commitHash, 'some-id')
      fail('Expected getTypeById to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(GraphQLError)
      const gqlError = error as GraphQLError
      expect(gqlError.message).toBe(errorMessage)
      expect(gqlError.extensions?.code).toBe(AdapterErrorCode.UNAUTHORIZED)
    }
  })
})
