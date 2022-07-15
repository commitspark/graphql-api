import { IGeneratedSchema } from './queries-mutations-generator.service'
import { Injectable } from '@nestjs/common'

@Injectable()
export class SchemaRootTypeGeneratorService {
  public generateSchemaRootTypeStrings(
    generatedSchemas: IGeneratedSchema[],
  ): string {
    return (
      `type Query {\n` +
      generatedSchemas
        .map((generated) => '  ' + generated.queryAllString)
        .join('\n') +
      generatedSchemas
        .map((generated) => '  ' + generated.queryAllMetaString)
        .join('\n') +
      generatedSchemas
        .map((generated) => '  ' + generated.queryByIdString)
        .join('\n') +
      '\n' +
      '}\n' +
      'type Mutation {\n' +
      generatedSchemas
        .map((generated) => '  ' + generated.createMutationString)
        .join('\n') +
      '\n' +
      generatedSchemas
        .map((generated) => '  ' + generated.updateMutationString)
        .join('\n') +
      '\n' +
      generatedSchemas
        .map((generated) => '  ' + generated.deleteMutationString)
        .join('\n') +
      '\n' +
      '}\n'
    )
  }
}
