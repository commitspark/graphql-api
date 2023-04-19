import { GraphQLField, GraphQLObjectType } from 'graphql'
import { Entry, PersistenceService } from '../persistence/persistence.service'
import { ApolloContext } from '../app/api.service'

export class EntryReferenceResolverGeneratorService {
  constructor(private readonly persistence: PersistenceService) {}

  public createResolver(
    context: ApolloContext,
    obj: {
      type: GraphQLObjectType
      fields: GraphQLField<any, any>[]
    },
  ): Record<string, RecordFieldResolvers> {
    const persistence = this.persistence
    const typeName = obj.type.name

    const fieldResolvers: RecordFieldResolvers = {}

    for (const field of obj.fields) {
      const fieldName = field.name
      fieldResolvers[fieldName] = async (
        parent: Record<string, any>,
      ): Promise<Entry | Entry[] | undefined> => {
        if (parent[fieldName] === undefined) {
          return undefined
        }
        // TODO decide this based on type definition, not data
        if (Array.isArray(parent[fieldName])) {
          return parent[fieldName].map((el: any) =>
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
            parent[fieldName].id,
          )
        }
      }
    }

    const result: Record<string, RecordFieldResolvers> = {}
    result[typeName] = fieldResolvers

    return result
  }
}

type RecordFieldResolvers = Record<
  string,
  (parent: Record<string, any>) => Promise<Entry | Entry[] | undefined>
>
