import { GraphQLField, GraphQLObjectType } from 'graphql'
import {
  Entry,
  PersistenceService,
} from '../../persistence/persistence.service'
import { ApolloContext } from '../../app/api.service'
import { GraphQLFieldResolver } from 'graphql/type/definition'

export class EntryReferenceResolverGenerator {
  constructor(private readonly persistence: PersistenceService) {}

  public createResolver(
    context: ApolloContext,
    obj: {
      type: GraphQLObjectType
      fields: GraphQLField<any, any>[]
    },
  ): Record<
    string,
    GraphQLFieldResolver<
      Record<string, any>,
      ApolloContext,
      any,
      Promise<Entry | Entry[] | undefined>
    >
  > {
    const persistence = this.persistence

    const fieldResolvers: Record<
      string,
      GraphQLFieldResolver<
        Record<string, any>,
        ApolloContext,
        any,
        Promise<Entry | Entry[] | undefined>
      >
    > = {}

    for (const field of obj.fields) {
      const fieldName = field.name
      fieldResolvers[fieldName] = async (
        source,
        args,
        context,
        info,
      ): Promise<Entry | Entry[] | undefined> => {
        if (source[fieldName] === undefined) {
          return undefined
        }
        // TODO decide this based on type definition, not data
        if (Array.isArray(source[fieldName])) {
          return source[fieldName].map((el: any) =>
            persistence.findById(
              context.gitAdapter,
              context.getCurrentRef(),
              el.id,
            ),
          )
        } else {
          return persistence.findById(
            context.gitAdapter,
            context.getCurrentRef(),
            source[fieldName].id,
          )
        }
      }
    }

    return fieldResolvers
  }
}
