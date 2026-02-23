import { mutationUpdateResolver } from '../../../src/graphql/resolvers/query-mutation-resolvers/mutation-update-resolver'
import { Entry, GitAdapter } from '@commitspark/git-adapter'
import {
  GraphQLID,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from 'graphql'
import { QueryMutationResolverContext } from '../../../src/graphql/resolvers/types.ts'
import { mock } from 'jest-mock-extended'
import { RepositoryCacheHandler } from '../../../src/persistence/cache.ts'

jest.mock('../../../src/persistence/persistence', () => ({
  findById: jest.fn(),
  findByTypeId: jest.fn(),
}))

jest.mock('../../../src/graphql/schema-utils/entry-reference-util', () => ({
  getReferencedEntryIds: jest.fn(),
}))

const { findById, findByTypeId } = jest.requireMock(
  '../../../src/persistence/persistence',
) as {
  findById: jest.Mock
  findByTypeId: jest.Mock
}

const { getReferencedEntryIds } = jest.requireMock(
  '../../../src/graphql/schema-utils/entry-reference-util',
) as {
  getReferencedEntryIds: jest.Mock
}

const makeObjectType = (name: string) =>
  new GraphQLObjectType({
    name,
    fields: {
      id: { type: new GraphQLNonNull(GraphQLID) },
    },
  })

describe('mutationUpdateResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not mutate the original referencedBy array of a newly referenced entry', async () => {
    const itemType = makeObjectType('Item')

    const itemId = 'item1'
    const boxId = 'box1'
    const otherItemId = 'otherItem'

    const boxReferencedBy = [otherItemId]

    const existingItem: Entry = {
      id: itemId,
      metadata: { type: 'Item' },
      data: {},
    }

    const box: Entry = {
      id: boxId,
      metadata: { type: 'Box', referencedBy: boxReferencedBy },
      data: {},
    }

    const updatedItem: Entry = {
      id: itemId,
      metadata: { type: 'Item' },
      data: { box: { id: boxId } },
    }

    const preCommitHash = 'oldHash'
    const postCommitHash = 'newHash'
    let currentHash = preCommitHash

    const gitAdapter = mock<GitAdapter>()
    gitAdapter.createCommit.mockResolvedValue({ ref: postCommitHash })

    const context: QueryMutationResolverContext = {
      type: itemType,
      branch: 'main',
      getCurrentHash: () => currentHash,
      setCurrentHash: (hash: string) => (currentHash = hash),
      gitAdapter,
      repositoryCache: mock<RepositoryCacheHandler>(),
    }

    findByTypeId.mockImplementation(
      async (
        contextArg: QueryMutationResolverContext,
        typeName: string,
        id: string,
      ) => {
        if (
          contextArg.getCurrentHash() === preCommitHash &&
          typeName === 'Item' &&
          id === itemId
        ) {
          return existingItem
        }
        if (
          contextArg.getCurrentHash() === postCommitHash &&
          typeName === 'Item' &&
          id === itemId
        ) {
          return updatedItem
        }
        throw new Error(`Unexpected findByTypeId call: ${typeName}, ${id}`)
      },
    )

    getReferencedEntryIds.mockImplementation(
      async (
        _rootType: unknown,
        _context: unknown,
        _fieldName: unknown,
        _returnType: unknown,
        data: Record<string, unknown>,
      ) => {
        if (data && 'box' in data) {
          return [boxId]
        }
        return []
      },
    )

    findById.mockImplementation(async (_context: unknown, id: string) => {
      if (id === boxId) {
        return box
      }
      throw new Error(`Unexpected findById call: ${id}`)
    })

    const args = {
      id: itemId,
      data: { box: { id: boxId } },
      commitMessage: 'update',
    }

    const info = mock<GraphQLResolveInfo>({
      returnType: itemType,
    })

    await mutationUpdateResolver(undefined, args, context, info)

    // assert the original reference array is unchanged as it resides in the immutable in-memory cache
    expect(boxReferencedBy).toEqual([otherItemId])
  })
})
