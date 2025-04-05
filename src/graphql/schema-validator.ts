import { GraphQLSchema, GraphQLUnionType, Kind } from 'graphql'

export class SchemaValidator {
  public getValidationResult(schema: GraphQLSchema): string[] {
    const results = []
    results.push(this.checkUnionMembersConsistentUseOfEntryDirective(schema))
    return results.filter((result) => result !== '')
  }

  private checkUnionMembersConsistentUseOfEntryDirective(
    schema: GraphQLSchema,
  ): string {
    const typeMap = schema.getTypeMap()

    for (const [key, type] of Object.entries(typeMap)) {
      if (type.astNode?.kind !== Kind.UNION_TYPE_DEFINITION) {
        continue
      }
      const innerTypes = (type as GraphQLUnionType).getTypes()

      const numberUnionMembersWithEntryDirective = innerTypes.filter(
        (innerType) =>
          !!innerType.astNode &&
          innerType.astNode.directives?.find(
            (directive) => directive.name.value === 'Entry',
          ) !== undefined,
      ).length

      if (
        numberUnionMembersWithEntryDirective !== 0 &&
        numberUnionMembersWithEntryDirective !== innerTypes.length
      ) {
        return `Either all union members of "${type.name}" must have "@Entry" directive or none.`
      }
    }

    return ''
  }
}
