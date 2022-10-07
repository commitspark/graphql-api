import { GraphQLField, GraphQLObjectType } from 'graphql'
import { Entry, PersistenceService } from '../persistence/persistence.service'
import { Injectable } from '@nestjs/common'
import { ApolloContext } from '../app/api.service'

@Injectable()
export class EntryReferenceResolverGeneratorService {
  constructor(private readonly persistence: PersistenceService) {}

  public createResolver(
    context: ApolloContext,
    obj: {
      type: GraphQLObjectType
      fields: GraphQLField<any, any>[]
    },
  ): any {
    const persistence = this.persistence
    const typeName = obj.type.name
    const fields = {}
    obj.fields.forEach((field) => {
      const fieldName = field.name
      fields[fieldName] = async function (parent): Promise<Entry | Entry[]> {
        if (parent[fieldName] === undefined) {
          return undefined
        }
        if (Array.isArray(parent[fieldName])) {
          return parent[fieldName].map((el) =>
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
    })

    const result = {}
    result[typeName] = fields

    return result
  }
}
