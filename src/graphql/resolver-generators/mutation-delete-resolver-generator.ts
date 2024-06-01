import {
  Entry,
  PersistenceService,
} from '../../persistence/persistence.service'
import { GraphQLFieldResolver } from 'graphql/type/definition'
import { ApolloContext } from '../../app/api.service'
import { GraphQLError } from 'graphql/error/GraphQLError'
import { ContentEntry } from '@commitspark/git-adapter'

export class MutationDeleteResolverGenerator {
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
      const entry: ContentEntry = await this.persistence.findByTypeId(
        context.gitAdapter,
        context.getCurrentRef(),
        typeName,
        args.id,
      )

      if (
        entry.metadata.referencedBy &&
        entry.metadata.referencedBy.length > 0
      ) {
        const otherIds = entry.metadata.referencedBy
          .map((referenceId) => `"${referenceId}"`)
          .join(', ')
        throw new GraphQLError(
          `Entry with id "${args.id}" is referenced by other entries: [${otherIds}]`,
          {
            extensions: {
              code: 'IN_USE',
              argumentName: 'id',
            },
          },
        )
      }

      const deleteResult = await this.persistence.deleteByTypeId(
        context.gitAdapter,
        context.branch,
        context.getCurrentRef(),
        typeName,
        args.id,
        args.message,
      )
      context.setCurrentRef(deleteResult.ref)

      return {
        id: args.id,
      }
    }
  }
}
