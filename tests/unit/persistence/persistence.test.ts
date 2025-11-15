import { GraphQLError } from 'graphql'
import { ErrorCode } from '../../../src'
import { findById, findByTypeId } from '../../../src/persistence/persistence'

// Helper to create a minimal ApolloContext-like object the functions expect
function makeContext(entries: Array<{ id: string; type: string }>) {
  const byId = new Map<string, any>()
  const byType = new Map<string, any[]>()

  for (const e of entries) {
    const entry = {
      metadata: { id: e.id, type: e.type },
    }
    byId.set(e.id, entry)
    const list = byType.get(e.type) ?? []
    list.push(entry)
    byType.set(e.type, list)
  }

  return {
    getCurrentHash: jest.fn().mockReturnValue('dummy-hash'),
    repositoryCache: {
      getEntriesRecord: jest.fn().mockResolvedValue({ byId, byType }),
    },
  }
}

describe('Persistence', () => {
  it('findById throws GraphQLError when entry does not exist', async () => {
    const context: any = makeContext([])
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
    const context: any = makeContext([])
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
    const context: any = makeContext([{ id: '1', type: 'Post' }])

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
