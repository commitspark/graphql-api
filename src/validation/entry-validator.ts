import {
  coerceInputValue,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLSchema,
  GraphQLUnionType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { Entry } from '@commitspark/git-adapter'
import {
  ENTRY_DIRECTIVE_NAME,
  hasDirective,
} from '../graphql/schema-utils/directive-util.ts'
import { isUnionOfEntryTypes } from '../graphql/schema-utils/entry-type-util.ts'
import { createViolation, Violation, ViolationCode } from './violation.ts'

type Path = (string | number)[]

/**
 * Returns the type name of the entry with the given ID, or `undefined` if no such entry exists.
 */
type EntryTypeLookup = (id: string) => string | undefined

/**
 * Validates an entry against a generated schema, i.e. a schema that contains the generated input types. Entry data
 * is stored in the shape of the generated input type of its entry type, so values are validated by coercing the data
 * to that input type. Keys that are not part of the schema are reported separately as warnings and do not take part
 * in the coercion. References are checked for existence and type of the referenced entry.
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
        entry.id,
      ),
    ]
  }

  const inputType = schema.getType(`${entryType.name}Input`)
  if (!isInputObjectType(inputType)) {
    throw new Error(
      `Expected generated input type for type "${entryType.name}".`,
    )
  }

  const violations: Violation[] = []
  const walker = new DataWalker(entry.id, getEntryType, violations)
  // the ID of an entry is not part of its data
  const data = walker.walkObject(entryType, entry.data ?? {}, [], ['id'])

  coerceInputValue(data, inputType, (path, _invalidValue, error) => {
    violations.push(
      createViolation(
        ViolationCode.INVALID_VALUE,
        error.message,
        [...path],
        entry.id,
      ),
    )
  })

  return violations
}

/**
 * Walks entry data along the object types of the schema. It reports unknown keys and checks references, and returns
 * a copy of the data without unknown keys. Values that do not have the expected shape are returned unchanged, so that
 * they are reported by the coercion to the input type.
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
  ): unknown {
    if (!isPlainObject(data)) {
      return data
    }
    const fields = type.getFields()
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      const field = fields[key]
      if (field === undefined || ignoredFieldNames.includes(key)) {
        this.reportUnknownField(type.name, key, [...path, key])
        continue
      }
      result[key] = this.walkValue(field.type, value, [...path, key])
    }
    return result
  }

  private walkValue(
    type: GraphQLOutputType,
    data: unknown,
    path: Path,
  ): unknown {
    if (data === null || data === undefined) {
      return data
    }
    if (isNonNullType(type)) {
      return this.walkValue(type.ofType, data, path)
    }
    if (isListType(type)) {
      if (!Array.isArray(data)) {
        return data
      }
      return data.map((element, index) =>
        this.walkValue(type.ofType, element, [...path, index]),
      )
    }
    if (isUnionType(type)) {
      if (isUnionOfEntryTypes(type)) {
        return this.walkReference(type, data, path)
      }
      return this.walkUnionValue(type, data, path)
    }
    if (isObjectType(type)) {
      if (hasDirective(type, ENTRY_DIRECTIVE_NAME)) {
        return this.walkReference(type, data, path)
      }
      return this.walkObject(type, data, path)
    }
    return data
  }

  private walkUnionValue(
    type: GraphQLUnionType,
    data: unknown,
    path: Path,
  ): unknown {
    if (!isPlainObject(data)) {
      return data
    }
    const keys = Object.keys(data)
    const memberType = type.getTypes().find((member) => member.name === keys[0])
    // other shapes are left to the coercion, which reports them as invalid `@oneOf` input
    if (keys.length !== 1 || memberType === undefined) {
      return data
    }
    return {
      [memberType.name]: this.walkObject(memberType, data[memberType.name], [
        ...path,
        memberType.name,
      ]),
    }
  }

  private walkReference(
    type: GraphQLObjectType | GraphQLUnionType,
    data: unknown,
    path: Path,
  ): unknown {
    if (!isPlainObject(data)) {
      return data
    }
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id') {
        this.reportUnknownField(`${type.name}IdInput`, key, [...path, key])
        continue
      }
      result[key] = value
    }
    if (typeof result.id === 'string') {
      this.checkReferenceTarget(type, result.id, [...path, 'id'])
    }
    return result
  }

  private checkReferenceTarget(
    type: GraphQLObjectType | GraphQLUnionType,
    id: string,
    path: Path,
  ): void {
    const referencedTypeName = this.getEntryType(id)
    if (referencedTypeName === undefined) {
      this.violations.push(
        createViolation(
          ViolationCode.DANGLING_REFERENCE,
          `Reference points to entry "${id}", which does not exist.`,
          path,
          this.entryId,
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
          this.entryId,
        ),
      )
    }
  }

  private reportUnknownField(typeName: string, key: string, path: Path): void {
    this.violations.push(
      createViolation(
        ViolationCode.UNKNOWN_FIELD,
        `Key "${key}" is not a field of type "${typeName}" in the schema.`,
        path,
        this.entryId,
      ),
    )
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
