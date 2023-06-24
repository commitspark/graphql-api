import { GraphQLFieldResolver } from 'graphql/type/definition'
import { ApolloContext } from '../../app/api.service'
import {
  Entry,
  PersistenceService,
} from '../../persistence/persistence.service'
import { GraphQLError } from 'graphql/error/GraphQLError'

export class MutationCreateResolverGenerator {
  constructor(private readonly persistence: PersistenceService) {}

  public createResolver(
    typeName: string,
  ): GraphQLFieldResolver<any, ApolloContext, any, Promise<Entry>> {
    return async (
      source,
      args,
      context: ApolloContext,
      info,
    ): Promise<Entry> => {
      let existingEntry
      try {
        existingEntry = await this.persistence.findById(
          context.gitAdapter,
          context.getCurrentRef(),
          args.id,
        )
      } catch (_) {}
      if (existingEntry) {
        throw new GraphQLError(`An entry with id "${args.id}" already exists`, {
          extensions: {
            code: 'BAD_USER_INPUT',
            argumentName: 'id',
          },
        })
      }

      // TODO validate ID references within args.data to assert referenced IDs exist and point to correct entry type
      const commitResult = await this.persistence.createType(
        context.gitAdapter,
        context.branch,
        context.getCurrentRef(),
        typeName,
        args.id,
        args.data,
        args.message,
      )
      context.setCurrentRef(commitResult.ref)
      return this.persistence.findByTypeId(
        context.gitAdapter,
        context.getCurrentRef(),
        typeName,
        args.id,
      )
    }
  }
}
