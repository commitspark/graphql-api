import { GraphQLObjectType, GraphQLSchema } from 'graphql'
import { getDirective } from '@graphql-tools/utils'
import { GraphQLInterfaceType, GraphQLUnionType } from 'graphql/type/definition'
import { Kind } from 'graphql/language/kinds'

export class SchemaAnalyzerService {
  public analyzeSchema(schema: GraphQLSchema): ISchemaAnalyzerResult {
    const result: ISchemaAnalyzerResult = {
      entryDirectiveTypes: [],
      objectTypes: [],
      interfaceTypes: [],
      unionTypes: [],
    }

    const typeMap = schema.getTypeMap()

    for (const [key, type] of Object.entries(typeMap)) {
      if (key.startsWith('__')) {
        continue
      }

      if (type.astNode?.kind === Kind.OBJECT_TYPE_DEFINITION) {
        const objectType = type as GraphQLObjectType
        result.objectTypes.push(objectType)
        const entityDirective = getDirective(schema, objectType, 'Entry')?.[0]
        if (entityDirective) {
          result.entryDirectiveTypes.push(objectType)
        }
      }

      if (type.astNode?.kind === Kind.INTERFACE_TYPE_DEFINITION) {
        const interfaceType = type as GraphQLInterfaceType
        result.interfaceTypes.push(interfaceType)
      }

      if (type.astNode?.kind === Kind.UNION_TYPE_DEFINITION) {
        const unionType = type as GraphQLUnionType
        result.unionTypes.push(unionType)
      }
    }

    return result
  }
}

export interface ISchemaAnalyzerResult {
  entryDirectiveTypes: GraphQLObjectType[]
  objectTypes: GraphQLObjectType[]
  interfaceTypes: GraphQLInterfaceType[]
  unionTypes: GraphQLUnionType[]
}
