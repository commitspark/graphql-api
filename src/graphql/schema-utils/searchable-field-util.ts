import {
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLSchema,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
} from 'graphql'
import { Entry } from '@commitspark/git-adapter'
import { SearchableFieldValue } from '@commitspark/search-adapter'
import {
  ENTRY_DIRECTIVE_NAME,
  hasDirective,
  SEARCHABLE_DIRECTIVE_NAME,
} from './directive-util.ts'
import { isUnionOfEntryTypes } from './entry-type-util.ts'
import { getUnionTypeNameFromFieldValue } from './union-type-util.ts'

// Returns every non-empty string value of searchable fields. Values that do not match the schema are skipped instead
// of failing the search.
export function extractSearchableFieldValues(
  schema: GraphQLSchema,
  entries: Iterable<Entry>,
): SearchableFieldValue[] {
  const searchableFieldValues: SearchableFieldValue[] = []
  for (const entry of entries) {
    const entryType = schema.getType(entry.metadata.type)
    if (!isObjectType(entryType) || !isRecord(entry.data)) {
      continue
    }
    const addValue = (fieldPath: string, value: string): void => {
      searchableFieldValues.push({
        entryId: entry.id,
        entryType: entryType.name,
        fieldPath: fieldPath,
        value: value,
      })
    }
    collectFromObject(schema, entryType, entry.data, '', addValue)
  }
  return searchableFieldValues
}

function collectFromObject(
  schema: GraphQLSchema,
  objectType: GraphQLObjectType,
  data: Record<string, unknown>,
  path: string,
  addValue: (fieldPath: string, value: string) => void,
): void {
  const isTypeSearchable = hasDirective(objectType, SEARCHABLE_DIRECTIVE_NAME)
  for (const field of Object.values(objectType.getFields())) {
    const value = data[field.name]
    if (value === undefined || value === null) {
      continue
    }
    collectFromValue(
      schema,
      field.type,
      value,
      path === '' ? field.name : `${path}.${field.name}`,
      isTypeSearchable || hasDirective(field, SEARCHABLE_DIRECTIVE_NAME),
      addValue,
    )
  }
}

function collectFromValue(
  schema: GraphQLSchema,
  type: GraphQLOutputType,
  value: unknown,
  path: string,
  isSearchable: boolean,
  addValue: (fieldPath: string, value: string) => void,
): void {
  if (isNonNullType(type)) {
    collectFromValue(schema, type.ofType, value, path, isSearchable, addValue)
  } else if (isListType(type)) {
    if (!Array.isArray(value)) {
      return
    }
    value.forEach((item, index) =>
      collectFromValue(
        schema,
        type.ofType,
        item,
        `${path}[${index}]`,
        isSearchable,
        addValue,
      ),
    )
  } else if (isScalarType(type)) {
    if (
      isSearchable &&
      type.name === 'String' &&
      typeof value === 'string' &&
      value.trim() !== ''
    ) {
      addValue(path, value)
    }
  } else if (isObjectType(type)) {
    // references to other entries are not followed, as each entry is indexed with its own content only
    if (!hasDirective(type, ENTRY_DIRECTIVE_NAME) && isRecord(value)) {
      collectFromObject(schema, type, value, path, addValue)
    }
  } else if (isUnionType(type)) {
    if (isUnionOfEntryTypes(type) || !isRecord(value)) {
      return
    }
    // non-entry union values are stored wrapped in an object keyed by their concrete type name, which is kept in the
    // path so that the path matches stored data and identifies the concrete type
    const concreteType = schema.getType(getUnionTypeNameFromFieldValue(value))
    const concreteValue = value[concreteType?.name ?? '']
    if (isObjectType(concreteType) && isRecord(concreteValue)) {
      collectFromObject(
        schema,
        concreteType,
        concreteValue,
        `${path}.${concreteType.name}`,
        addValue,
      )
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
