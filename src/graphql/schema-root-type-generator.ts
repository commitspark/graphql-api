import { GeneratedQuery, GeneratedSchema } from './queries-mutations-generator'

export function generateSchemaRootTypeStrings(
  generatedSchemas: GeneratedSchema[],
  typeQuery: GeneratedQuery<Promise<string>>,
): string {
  return (
    `type Query {\n` +
    generatedSchemas
      .map((generated) => '  ' + generated.queryAll.schemaString)
      .join('\n') +
    '\n' +
    generatedSchemas
      .map((generated) => '  ' + generated.queryById.schemaString)
      .join('\n') +
    '\n' +
    `  ${typeQuery.schemaString}` +
    '\n' +
    '}\n\n' +
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
