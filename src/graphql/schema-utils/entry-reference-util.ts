import {
  GraphQLNullableType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLUnionType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
} from 'graphql'
import { ApolloContext } from '../../client.ts'
import { getTypeById } from '../../persistence/persistence.ts'
import { EntriesRecord } from '../../persistence/cache.ts'
import {
  getUnionTypeNameFromFieldValue,
  getUnionValue,
} from './union-type-util.ts'
import { ENTRY_DIRECTIVE_NAME, hasDirective } from './directive-util.ts'
import { isUnionOfEntryTypes } from './entry-type-util.ts'
import { createError, ErrorCode } from '../errors.ts'
import { EntryData } from '@commitspark/git-adapter'
import { isEntryData } from '../util.ts'

interface EntryReference {
  id: string
  fieldName: string
  fieldType: GraphQLObjectType | GraphQLUnionType
}

type ReferencedByIndex = Map<string, string[]>

// commits are immutable, so an index built from the cached entries of a commit stays valid for as long as these
// entries remain cached
const referencedByIndexes = new WeakMap<EntriesRecord, ReferencedByIndex>()

export async function validateEntryReferences(
  entryType: GraphQLObjectType,
  context: ApolloContext,
  data: EntryData,
): Promise<void> {
  for (const reference of getEntryReferences(entryType, data)) {
    let referencedTypeName
    try {
      referencedTypeName = await getTypeById(context, reference.id)
    } catch {
      throw createError(
        `Failed to resolve entry reference "${reference.id}".`,
        ErrorCode.BAD_USER_INPUT,
        {
          fieldName: reference.fieldName,
          fieldValue: reference.id,
        },
      )
    }
    if (!isPermittedReferenceType(referencedTypeName, reference.fieldType)) {
      throw createError(
        `Reference with ID "${reference.id}" points to entry of incompatible type "${referencedTypeName}".`,
        ErrorCode.BAD_USER_INPUT,
        {
          fieldName: reference.fieldName,
          fieldValue: reference.id,
        },
      )
    }
  }
}

export async function getReferencingEntryIds(
  context: ApolloContext,
  schema: GraphQLSchema,
  id: string,
): Promise<string[]> {
  const entriesRecord = await context.repositoryCache.getEntriesRecord(
    context,
    context.getCurrentHash(),
  )
  let referencedByIndex = referencedByIndexes.get(entriesRecord)
  if (referencedByIndex === undefined) {
    referencedByIndex = buildReferencedByIndex(schema, entriesRecord)
    referencedByIndexes.set(entriesRecord, referencedByIndex)
  }
  return referencedByIndex.get(id) ?? []
}

function buildReferencedByIndex(
  schema: GraphQLSchema,
  entriesRecord: EntriesRecord,
): ReferencedByIndex {
  const referencedByIndex: ReferencedByIndex = new Map()
  for (const entry of entriesRecord.byId.values()) {
    const entryType = schema.getType(entry.metadata.type)
    if (
      !isObjectType(entryType) ||
      !hasDirective(entryType, ENTRY_DIRECTIVE_NAME)
    ) {
      throw createError(
        `Entry "${entry.id}" is of type "${entry.metadata.type}", which is not a type with directive ` +
          `@${ENTRY_DIRECTIVE_NAME} in the schema.`,
        ErrorCode.BAD_REPOSITORY_DATA,
        {
          typeName: entry.metadata.type,
          fieldValue: entry.id,
        },
      )
    }

    const referencedIds = new Set(
      getEntryReferences(entryType, entry.data ?? null).map(
        (reference) => reference.id,
      ),
    )
    for (const referencedId of referencedIds) {
      const referencingIds = referencedByIndex.get(referencedId) ?? []
      referencingIds.push(entry.id)
      referencedByIndex.set(referencedId, referencingIds)
    }
  }

  for (const referencingIds of referencedByIndex.values()) {
    referencingIds.sort()
  }
  return referencedByIndex
}

function getEntryReferences(
  entryType: GraphQLObjectType,
  data: EntryData,
): EntryReference[] {
  // the fields of the entry itself are traversed directly, so that any nested @Entry type is treated as reference,
  // including references to entries of the same type
  return getReferencesInObjectFields(entryType, data)
}

function getReferencesInObjectFields(
  type: GraphQLObjectType,
  data: unknown,
): EntryReference[] {
  if (data === null || data === undefined) {
    return []
  }
  // expect our object type to hold EntryData (i.e. an object)
  if (!isEntryData(data) || data === null) {
    throw createError(
      `Expected object as data for type "${type.name}".`,
      ErrorCode.BAD_REPOSITORY_DATA,
      {
        typeName: type.name,
        fieldValue: data,
      },
    )
  }

  return Object.entries(type.getFields()).flatMap(([fieldName, field]) =>
    getReferencesInField(fieldName, field.type, data[fieldName]),
  )
}

function getReferencesInField(
  fieldName: string,
  type: GraphQLNullableType,
  data: unknown,
): EntryReference[] {
  if (data === null || data === undefined || isScalarType(type)) {
    return []
  }

  if (isNonNullType(type)) {
    return getReferencesInField(fieldName, type.ofType, data)
  }

  if (isListType(type)) {
    if (!Array.isArray(data)) {
      throw createError(
        `Expected array as data for field "${fieldName}".`,
        ErrorCode.BAD_REPOSITORY_DATA,
        {
          fieldName: fieldName,
          fieldValue: data,
        },
      )
    }
    return data.flatMap((element) =>
      getReferencesInField(fieldName, type.ofType, element),
    )
  }

  if (isUnionType(type)) {
    if (isUnionOfEntryTypes(type)) {
      return [createEntryReference(fieldName, type, data)]
    }

    const requestedUnionTypeName = getUnionTypeNameFromFieldValue(data)
    const concreteFieldUnionType = type
      .getTypes()
      .find(
        (concreteFieldType) =>
          concreteFieldType.name === requestedUnionTypeName,
      )
    if (!concreteFieldUnionType) {
      throw createError(
        `Type "${requestedUnionTypeName}" found in field data is not a valid type for ` +
          `union type "${type.name}".`,
        ErrorCode.BAD_REPOSITORY_DATA,
        {
          typeName: type.name,
          fieldName: fieldName,
          fieldValue: data,
        },
      )
    }
    return getReferencesInObjectFields(
      concreteFieldUnionType,
      getUnionValue(data),
    )
  }

  if (isObjectType(type)) {
    if (hasDirective(type, ENTRY_DIRECTIVE_NAME)) {
      return [createEntryReference(fieldName, type, data)]
    }
    return getReferencesInObjectFields(type, data)
  }

  return []
}

function createEntryReference(
  fieldName: string,
  fieldType: GraphQLObjectType | GraphQLUnionType,
  data: unknown,
): EntryReference {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('id' in data) ||
    typeof data.id !== 'string'
  ) {
    throw createError(
      `Expected key "id" with value of type string in data of field "${fieldName}" of type "${fieldType.name}".`,
      ErrorCode.BAD_REPOSITORY_DATA,
      {
        typeName: fieldType.name,
        fieldName: fieldName,
        fieldValue: data,
      },
    )
  }
  return { id: data.id, fieldName, fieldType }
}

function isPermittedReferenceType(
  referencedTypeName: string,
  fieldType: GraphQLObjectType | GraphQLUnionType,
): boolean {
  if (isUnionType(fieldType)) {
    return fieldType
      .getTypes()
      .some((concreteType) => concreteType.name === referencedTypeName)
  }
  return fieldType.name === referencedTypeName
}
