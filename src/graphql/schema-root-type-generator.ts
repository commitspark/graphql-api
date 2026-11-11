import {
  GeneratedQuery,
  GeneratedSchema,
  GeneratedSearchQuery,
} from './queries-mutations-generator.ts'
import {
  MUTATION_TYPE_NAME,
  QUERY_TYPE_NAME,
} from './schema-utils/generated-names.ts'

export function generateSchemaRootTypeStrings(
  generatedSchemas: GeneratedSchema[],
  typeQuery: GeneratedQuery,
  searchQuery: GeneratedSearchQuery | undefined,
): string {
  return (
    `type ${QUERY_TYPE_NAME} {\n` +
    generatedSchemas
      .map((generated) => '  ' + generated.queryEvery.schemaString)
      .join('\n') +
    '\n' +
    generatedSchemas
      .map((generated) => '  ' + generated.queryById.schemaString)
      .join('\n') +
    '\n' +
    `  ${typeQuery.schemaString}` +
    '\n' +
    (searchQuery !== undefined ? `  ${searchQuery.schemaString}\n` : '') +
    '}\n\n' +
    `type ${MUTATION_TYPE_NAME} {\n` +
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
