import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLUnionType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { getDirective } from '@graphql-tools/utils'
import { ENTRY_DIRECTIVE_NAME } from './schema-utils/directive-util.ts'

export function analyzeSchema(schema: GraphQLSchema): SchemaAnalyzerResult {
  const result: SchemaAnalyzerResult = {
    entryDirectiveTypes: [],
    objectTypes: [],
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
      const entityDirective = getDirective(
        schema,
        objectType,
        ENTRY_DIRECTIVE_NAME,
      )?.[0]
      if (entityDirective) {
        result.entryDirectiveTypes.push(objectType)
      }
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
  unionTypes: GraphQLUnionType[]
}
