import {
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLUnionType,
  isInterfaceType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { getDirective } from '@graphql-tools/utils'

export function analyzeSchema(schema: GraphQLSchema): SchemaAnalyzerResult {
  const result: SchemaAnalyzerResult = {
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

    if (isObjectType(type)) {
      const objectType = type as GraphQLObjectType
      result.objectTypes.push(objectType)
      const entityDirective = getDirective(schema, objectType, 'Entry')?.[0]
      if (entityDirective) {
        result.entryDirectiveTypes.push(objectType)
      }
    }

    if (isInterfaceType(type)) {
      const interfaceType = type as GraphQLInterfaceType
      result.interfaceTypes.push(interfaceType)
    }

    if (isUnionType(type)) {
      const unionType = type as GraphQLUnionType
      result.unionTypes.push(unionType)
    }
  }

  return result
}

export interface SchemaAnalyzerResult {
  entryDirectiveTypes: GraphQLObjectType[]
  objectTypes: GraphQLObjectType[]
  interfaceTypes: GraphQLInterfaceType[]
  unionTypes: GraphQLUnionType[]
}
