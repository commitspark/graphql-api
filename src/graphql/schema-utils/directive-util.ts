import { GraphQLField, GraphQLNamedType } from 'graphql'

export const ENTRY_DIRECTIVE_NAME = 'Entry'
export const SEARCHABLE_DIRECTIVE_NAME = 'Searchable'

export function hasDirective(
  typeOrField: GraphQLNamedType | GraphQLField<unknown, unknown>,
  directiveName: string,
): boolean {
  return (
    typeOrField.astNode?.directives?.some(
      (directive) => directive.name.value === directiveName,
    ) ?? false
  )
}
