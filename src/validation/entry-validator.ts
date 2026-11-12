import {
  coerceInputValue,
  GraphQLEnumType,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
  isEnumType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
} from 'graphql'
import { Entry } from '@commitspark/git-adapter'
import {
  ENTRY_DIRECTIVE_NAME,
  hasDirective,
} from '../graphql/schema-utils/directive-util.ts'
import { isUnionOfEntryTypes } from '../graphql/schema-utils/entry-type-util.ts'
import {
  idInputTypeName,
  REFERENCED_BY_FIELD_NAME,
  VERSION_FIELD_NAME,
} from '../graphql/schema-utils/generated-names.ts'
import { createViolation, Violation, ViolationCode } from './violation.ts'

type Path = (string | number)[]

/**
 * Returns the type name of the entry with the given ID, or `undefined` if no such entry exists.
 */
type EntryTypeLookup = (id: string) => string | undefined

/**
 * Validates an entry against the schema. Every violation is reported with the path of the value it concerns, e.g.
 * `['seo', 'title']` for a missing value of a non-null field `title` of an object in field `seo`, so that reads can
 * report it at the corresponding position of a response. Values of scalars and enums are validated by coercing them
 * as GraphQL input values, as entry data is stored in the shape of the generated input types. Keys that are not part
 * of the schema are reported as warnings. References are checked for existence and type of the referenced entry.
 */
export function validateEntry(
  schema: GraphQLSchema,
  entry: Entry,
  getEntryType: EntryTypeLookup,
): Violation[] {
  const entryType = schema.getType(entry.metadata.type)
  if (
    !isObjectType(entryType) ||
    !hasDirective(entryType, ENTRY_DIRECTIVE_NAME)
  ) {
    return [
      createViolation(
        ViolationCode.UNKNOWN_ENTRY_TYPE,
        `Entry is of type "${entry.metadata.type}", which is not a type with directive @${ENTRY_DIRECTIVE_NAME} in ` +
          `the schema.`,
        [],
        { entryId: entry.id },
      ),
    ]
  }

  const violations: Violation[] = []
  const walker = new DataWalker(entry.id, getEntryType, violations)
  // the ID of an entry is not part of its data, and fields generated for entries are not stored
  walker.walkObject(
    entryType,
    entry.data ?? {},
    [],
    ['id', REFERENCED_BY_FIELD_NAME, VERSION_FIELD_NAME],
  )
  return violations
}

/**
 * Walks entry data along the types of the schema and records a violation for every value that does not match its
 * type. The walk does not descend into values of the wrong shape, so that every value is reported at most once.
 */
class DataWalker {
  constructor(
    private readonly entryId: string,
    private readonly getEntryType: EntryTypeLookup,
    private readonly violations: Violation[],
  ) {}

  walkObject(
    type: GraphQLObjectType,
    data: unknown,
    path: Path,
    ignoredFieldNames: string[] = [],
  ): void {
    if (!isPlainObject(data)) {
      this.reportInvalidValue(
        `Expected an object of type "${type.name}".`,
        path,
        data,
      )
      return
    }

    const fields = type.getFields()
    for (const key of Object.keys(data)) {
      if (fields[key] === undefined || ignoredFieldNames.includes(key)) {
        this.violations.push(
          createViolation(
            ViolationCode.UNKNOWN_FIELD,
            `Key "${key}" is not a field of type "${type.name}" in the schema.`,
            [...path, key],
            { entryId: this.entryId, value: data[key] },
          ),
        )
      }
    }

    for (const field of Object.values(fields)) {
      if (ignoredFieldNames.includes(field.name)) {
        continue
      }
      const value = data[field.name]
      if (
        (value === undefined || value === null) &&
        isNonNullType(field.type)
      ) {
        this.reportInvalidValue(
          value === undefined
            ? `Field "${field.name}" of required type "${field.type}" was not provided.`
            : `Field "${field.name}" of required type "${field.type}" must not be null.`,
          [...path, field.name],
          value,
        )
        continue
      }
      this.walkValue(field.type, value, [...path, field.name])
    }
  }

  private walkValue(type: GraphQLOutputType, data: unknown, path: Path): void {
    if (isNonNullType(type)) {
      if (data === undefined || data === null) {
        this.reportInvalidValue(
          `Value of required type "${type}" must not be null.`,
          path,
          data,
        )
        return
      }
      this.walkValue(type.ofType, data, path)
      return
    }
    if (data === undefined || data === null) {
      return
    }

    if (isListType(type)) {
      if (!Array.isArray(data)) {
        this.reportInvalidValue(
          `Expected a list of type "${type}".`,
          path,
          data,
        )
        return
      }
      data.forEach((element, index) =>
        this.walkValue(type.ofType, element, [...path, index]),
      )
      return
    }
    if (isUnionType(type)) {
      if (isUnionOfEntryTypes(type)) {
        this.walkReference(type, data, path)
      } else {
        this.walkUnionValue(type, data, path)
      }
      return
    }
    if (isObjectType(type)) {
      if (hasDirective(type, ENTRY_DIRECTIVE_NAME)) {
        this.walkReference(type, data, path)
      } else {
        this.walkObject(type, data, path)
      }
      return
    }
    if (isScalarType(type) || isEnumType(type)) {
      this.walkLeafValue(type, data, path)
    }
  }

  private walkLeafValue(
    type: GraphQLScalarType | GraphQLEnumType,
    data: unknown,
    path: Path,
  ): void {
    coerceInputValue(data, type, (_path, _invalidValue, error) =>
      this.reportInvalidValue(error.message, path, data),
    )
  }

  private walkUnionValue(
    type: GraphQLUnionType,
    data: unknown,
    path: Path,
  ): void {
    const keys = isPlainObject(data) ? Object.keys(data) : []
    const memberType = type
      .getTypes()
      .find((member) => keys.length === 1 && member.name === keys[0])
    if (!isPlainObject(data) || memberType === undefined) {
      this.reportInvalidValue(
        `Expected an object with a single key naming the member type of union "${type.name}", one of ` +
          `${type
            .getTypes()
            .map((member) => `"${member.name}"`)
            .join(', ')}.`,
        path,
        data,
      )
      return
    }
    this.walkObject(memberType, data[memberType.name], [
      ...path,
      memberType.name,
    ])
  }

  private walkReference(
    type: GraphQLObjectType | GraphQLUnionType,
    data: unknown,
    path: Path,
  ): void {
    if (!isPlainObject(data) || typeof data.id !== 'string') {
      this.reportInvalidValue(
        `Expected a reference to an entry of type "${type.name}", i.e. an object with key "id" holding the ID of ` +
          `the entry.`,
        path,
        data,
      )
      return
    }
    for (const key of Object.keys(data)) {
      if (key !== 'id') {
        this.violations.push(
          createViolation(
            ViolationCode.UNKNOWN_FIELD,
            `Key "${key}" is not a field of type "${idInputTypeName(type.name)}" in the schema.`,
            [...path, key],
            { entryId: this.entryId, value: data[key] },
          ),
        )
      }
    }
    this.checkReferenceTarget(type, data.id, data, path)
  }

  private checkReferenceTarget(
    type: GraphQLObjectType | GraphQLUnionType,
    id: string,
    reference: Record<string, unknown>,
    path: Path,
  ): void {
    const referencedTypeName = this.getEntryType(id)
    if (referencedTypeName === undefined) {
      this.violations.push(
        createViolation(
          ViolationCode.DANGLING_REFERENCE,
          `Reference points to entry "${id}", which does not exist.`,
          path,
          { entryId: this.entryId, value: reference },
        ),
      )
      return
    }
    const permittedTypeNames = isUnionType(type)
      ? type.getTypes().map((member) => member.name)
      : [type.name]
    if (!permittedTypeNames.includes(referencedTypeName)) {
      this.violations.push(
        createViolation(
          ViolationCode.INCOMPATIBLE_REFERENCE,
          `Reference points to entry "${id}" of type "${referencedTypeName}", but field permits only type ` +
            `${permittedTypeNames.map((name) => `"${name}"`).join(', ')}.`,
          path,
          { entryId: this.entryId, value: reference },
        ),
      )
    }
  }

  /**
   * Records an invalid value together with the value as stored; a missing value (`undefined`) is recorded without one.
   */
  private reportInvalidValue(
    message: string,
    path: Path,
    value: unknown,
  ): void {
    this.violations.push(
      createViolation(ViolationCode.INVALID_VALUE, message, path, {
        entryId: this.entryId,
        value,
      }),
    )
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
