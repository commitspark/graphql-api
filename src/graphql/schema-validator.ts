import {
  DocumentNode,
  getNamedType,
  GraphQLNamedType,
  GraphQLSchema,
  isInputObjectType,
  isInterfaceType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isSpecifiedScalarType,
  isTypeExtensionNode,
  isUnionType,
  Kind,
} from 'graphql'
import {
  ENTRY_DIRECTIVE_NAME,
  hasDirective,
  SEARCHABLE_DIRECTIVE_NAME,
} from './schema-utils/directive-util.ts'

/**
 * Returns the types defined in the schema by the user, i.e. without introspection types and built-in scalars.
 */
function getUserTypes(schema: GraphQLSchema): GraphQLNamedType[] {
  return Object.values(schema.getTypeMap()).filter(
    (type) =>
      !type.name.startsWith('__') &&
      !(isScalarType(type) && isSpecifiedScalarType(type)),
  )
}

/**
 * Rejects GraphQL constructs that Commitspark does not support, so that they do not silently lead to unexpected
 * behavior or an invalid generated schema. Only object types, unions, enums, built-in scalars and directives are
 * supported.
 */
function checkSupportedConstructs(
  schema: GraphQLSchema,
  document: DocumentNode,
): string[] {
  const results: string[] = []

  // schema definitions and type extensions are detected in the document, as building the schema merges type
  // extensions into their types and adds a schema definition for root types
  for (const definition of document.definitions) {
    if (
      definition.kind === Kind.SCHEMA_DEFINITION ||
      definition.kind === Kind.SCHEMA_EXTENSION
    ) {
      results.push(
        'Schema definitions ("schema { ... }") are not supported, as Commitspark generates the root types.',
      )
    } else if (isTypeExtensionNode(definition)) {
      results.push(
        `Type extensions ("extend") of "${definition.name.value}" are not supported; declare the type in a ` +
          `single definition.`,
      )
    }
  }

  for (const type of getUserTypes(schema)) {
    if (isInterfaceType(type)) {
      results.push(
        `Interface "${type.name}" is not supported; use a union instead.`,
      )
    } else if (isInputObjectType(type)) {
      results.push(
        `Input type "${type.name}" is not supported, as Commitspark generates input types.`,
      )
    } else if (isScalarType(type)) {
      results.push(
        `Custom scalar "${type.name}" is not supported; use one of the built-in scalars "String", "Int", ` +
          `"Float", "Boolean" and "ID".`,
      )
    }

    if (isObjectType(type)) {
      for (const field of Object.values(type.getFields())) {
        if (field.args.length > 0) {
          results.push(
            `Field "${type.name}.${field.name}" has arguments, which are not supported.`,
          )
        }
      }
    }
  }

  return results
}

function checkUnionMembersConsistentUseOfEntryDirective(
  schema: GraphQLSchema,
): string[] {
  return getUserTypes(schema)
    .filter((type) => isUnionType(type))
    .filter((type) => {
      const members = type.getTypes()
      const numberMembersWithEntryDirective = members.filter((member) =>
        hasDirective(member, ENTRY_DIRECTIVE_NAME),
      ).length
      return (
        numberMembersWithEntryDirective !== 0 &&
        numberMembersWithEntryDirective !== members.length
      )
    })
    .map(
      (type) =>
        `Either all union members of "${type.name}" must have "@${ENTRY_DIRECTIVE_NAME}" directive or none.`,
    )
}

function checkSearchableDirectiveOnlyOnStringFields(
  schema: GraphQLSchema,
): string[] {
  const results: string[] = []
  for (const type of getUserTypes(schema)) {
    if (!isObjectType(type)) {
      continue
    }
    for (const field of Object.values(type.getFields())) {
      if (!hasDirective(field, SEARCHABLE_DIRECTIVE_NAME)) {
        continue
      }
      const namedType = getNamedType(field.type)
      if (!isScalarType(namedType) || namedType.name !== 'String') {
        results.push(
          `Field "${type.name}.${field.name}" must be of type "String" or a list of "String" to use ` +
            `"@${SEARCHABLE_DIRECTIVE_NAME}" directive.`,
        )
      }
    }
  }
  return results
}

function checkEntryTypesHaveIdField(schema: GraphQLSchema): string[] {
  return getUserTypes(schema)
    .filter(
      (type) => isObjectType(type) && hasDirective(type, ENTRY_DIRECTIVE_NAME),
    )
    .filter((type) => {
      const idField = isObjectType(type) ? type.getFields()['id'] : undefined
      return (
        idField === undefined ||
        !isNonNullType(idField.type) ||
        !isScalarType(idField.type.ofType) ||
        idField.type.ofType.name !== 'ID'
      )
    })
    .map(
      (type) =>
        `Type "${type.name}" must have a field "id" of type "ID!" to use "@${ENTRY_DIRECTIVE_NAME}" directive.`,
    )
}

/**
 * Validates the schema defined by the user and returns a message for every problem found. `document` is the parsed
 * schema definition the schema was built from.
 */
export function getValidationResult(
  schema: GraphQLSchema,
  document: DocumentNode,
): string[] {
  return [
    ...checkSupportedConstructs(schema, document),
    ...checkEntryTypesHaveIdField(schema),
    ...checkUnionMembersConsistentUseOfEntryDirective(schema),
    ...checkSearchableDirectiveOnlyOnStringFields(schema),
  ]
}
