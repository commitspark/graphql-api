import {
  GraphQLField,
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
import { SearchDocument } from '@commitspark/search-adapter'
import { hasEntryDirective, isUnionOfEntryTypes } from './entry-type-util.ts'
import { getUnionTypeNameFromFieldValue } from './union-type-util.ts'

export const SEARCHABLE_DIRECTIVE_NAME = 'Searchable'

export function hasSearchableDirective(
  typeOrField: GraphQLObjectType | GraphQLField<unknown, unknown>,
): boolean {
  return (
    typeOrField.astNode?.directives?.find(
      (directive) => directive.name.value === SEARCHABLE_DIRECTIVE_NAME,
    ) !== undefined
  )
}

// Returns one document per non-empty string value of a searchable field. Values that do not match the schema are
// skipped instead of failing the search.
export function extractSearchDocuments(
  schema: GraphQLSchema,
  entries: Iterable<Entry>,
): SearchDocument[] {
  const documents: SearchDocument[] = []
  for (const entry of entries) {
    const entryType = schema.getType(entry.metadata.type)
    if (!isObjectType(entryType) || !isRecord(entry.data)) {
      continue
    }
    const addDocument = (fieldPath: string, text: string): void => {
      documents.push({
        entryId: entry.id,
        entryType: entryType.name,
        fieldPath: fieldPath,
        text: text,
      })
    }
    collectFromObject(schema, entryType, entry.data, '', addDocument)
  }
  return documents
}

function collectFromObject(
  schema: GraphQLSchema,
  objectType: GraphQLObjectType,
  data: Record<string, unknown>,
  path: string,
  addDocument: (fieldPath: string, text: string) => void,
): void {
  const isTypeSearchable = hasSearchableDirective(objectType)
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
      isTypeSearchable || hasSearchableDirective(field),
      addDocument,
    )
  }
}

function collectFromValue(
  schema: GraphQLSchema,
  type: GraphQLOutputType,
  value: unknown,
  path: string,
  isSearchable: boolean,
  addDocument: (fieldPath: string, text: string) => void,
): void {
  if (isNonNullType(type)) {
    collectFromValue(
      schema,
      type.ofType,
      value,
      path,
      isSearchable,
      addDocument,
    )
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
        addDocument,
      ),
    )
  } else if (isScalarType(type)) {
    if (
      isSearchable &&
      type.name === 'String' &&
      typeof value === 'string' &&
      value.trim() !== ''
    ) {
      addDocument(path, value)
    }
  } else if (isObjectType(type)) {
    // references to other entries are not followed, as each entry is indexed with its own content only
    if (!hasEntryDirective(type) && isRecord(value)) {
      collectFromObject(schema, type, value, path, addDocument)
    }
  } else if (isUnionType(type)) {
    if (isUnionOfEntryTypes(type) || !isRecord(value)) {
      return
    }
    // non-entry union values are stored wrapped in an object keyed by their concrete type name
    const concreteType = schema.getType(getUnionTypeNameFromFieldValue(value))
    const concreteValue = value[concreteType?.name ?? '']
    if (isObjectType(concreteType) && isRecord(concreteValue)) {
      collectFromObject(schema, concreteType, concreteValue, path, addDocument)
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
