import {
  IGeneratedQuery,
  IGeneratedSchema,
} from './queries-mutations-generator.service'
import { Injectable } from '@nestjs/common'

@Injectable()
export class SchemaRootTypeGeneratorService {
  public generateSchemaRootTypeStrings(
    generatedSchemas: IGeneratedSchema[],
    typeQuery: IGeneratedQuery<Promise<string>>,
  ): string {
    return (
      `type Query {\n` +
      generatedSchemas
        .map((generated) => '  ' + generated.queryAll.schemaString)
        .join('\n') +
      generatedSchemas
        .map((generated) => '  ' + generated.queryAllMeta.schemaString)
        .join('\n') +
      generatedSchemas
        .map((generated) => '  ' + generated.queryById.schemaString)
        .join('\n') +
      '\n' +
      `  ${typeQuery.schemaString}` +
      '\n' +
      '}\n' +
      'type Mutation {\n' +
      generatedSchemas
        .map((generated) => '  ' + generated.createMutation.schemaString)
        .join('\n') +
      '\n' +
      generatedSchemas
        .map((generated) => '  ' + generated.updateMutation.schemaString)
        .join('\n') +
      '\n' +
      generatedSchemas
        .map((generated) => '  ' + generated.deleteMutation.schemaString)
        .join('\n') +
      '\n' +
      '}\n'
    )
  }
}
