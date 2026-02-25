import { GraphQLError } from 'graphql'
import { ErrorCode } from '../../../src'
import { findById, findByTypeId } from '../../../src/persistence/persistence'
import type { ApolloContext } from '../../../src/client'
import { Entry } from '@commitspark/git-adapter'

function mockApolloContext(
  entries: Array<{ id: string; type: string }>,
): ApolloContext {
  const byId = new Map<string, Entry>()
  const byType = new Map<string, Entry[]>()

  for (const entry of entries) {
    const generatedEntry = {
      id: entry.id,
      metadata: { type: entry.type },
    }
    byId.set(entry.id, generatedEntry)
    const list = byType.get(entry.type) ?? []
    list.push(generatedEntry)
    byType.set(entry.type, list)
  }

  return {
    getCurrentHash: jest.fn().mockReturnValue('dummy-hash'),
    repositoryCache: {
      getEntriesRecord: jest.fn().mockResolvedValue({ byId, byType }),
    },
  } as unknown as ApolloContext
}

describe('Persistence', () => {
  it('findById throws GraphQLError when entry does not exist', async () => {
    const context = mockApolloContext([])
    const missingId = 'missing-id'

    try {
      await findById(context, missingId)
      fail('Expected findById to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(GraphQLError)
      const gqlError = error as GraphQLError
      expect(gqlError.message).toBe(`No entry with ID "${missingId}" exists.`)
      expect(gqlError.extensions?.code).toBe(ErrorCode.NOT_FOUND)
      expect(gqlError.extensions?.commitspark).toEqual({
        argumentName: 'id',
        argumentValue: missingId,
      })
    }
  })

  it('findByTypeId propagates GraphQLError when id does not exist', async () => {
    const context = mockApolloContext([])
    const missingId = '42'

    await expect(
      findByTypeId(context, 'AnyType', missingId),
    ).rejects.toBeInstanceOf(GraphQLError)

    // Inspect full error details
    try {
      await findByTypeId(context, 'AnyType', missingId)
      fail('Expected findByTypeId to throw')
    } catch (error) {
      const gqlError = error as GraphQLError
      expect(gqlError.message).toBe(`No entry with ID "${missingId}" exists.`)
      expect(gqlError.extensions?.code).toBe(ErrorCode.NOT_FOUND)
      expect(gqlError.extensions?.commitspark).toEqual({
        argumentName: 'id',
        argumentValue: missingId,
      })
    }
  })

  it('findByTypeId throws GraphQLError when type does not match', async () => {
    const context = mockApolloContext([{ id: '1', type: 'Post' }])

    const requestedType = 'User'
    const id = '1'

    try {
      await findByTypeId(context, requestedType, id)
      fail('Expected findByTypeId to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(GraphQLError)
      const gqlError = error as GraphQLError
      expect(gqlError.message).toBe(
        `No entry of type "${requestedType}" with ID "${id}" exists.`,
      )
      expect(gqlError.extensions?.code).toBe(ErrorCode.NOT_FOUND)
      expect(gqlError.extensions?.commitspark).toEqual({
        typeName: requestedType,
        argumentName: 'id',
        argumentValue: id,
      })
    }
  })
})
