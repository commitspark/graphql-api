export enum ViolationSeverity {
  /**
   * The data cannot be read correctly. Reading an affected entry fails.
   */
  ERROR = 'ERROR',
  /**
   * The data can be read, but the repository holds data that is not part of the schema.
   */
  WARNING = 'WARNING',
}

export enum ViolationCode {
  /**
   * The schema is not valid.
   */
  INVALID_SCHEMA = 'INVALID_SCHEMA',
  /**
   * The type of an entry is not a type with directive `@Entry` in the schema.
   */
  UNKNOWN_ENTRY_TYPE = 'UNKNOWN_ENTRY_TYPE',
  /**
   * A value does not match the type of its field, e.g. a missing value of a non-null field or a string in a field
   * of type `Int`.
   */
  INVALID_VALUE = 'INVALID_VALUE',
  /**
   * A reference points to an entry that does not exist.
   */
  DANGLING_REFERENCE = 'DANGLING_REFERENCE',
  /**
   * A reference points to an entry of a type that is not permitted by the field.
   */
  INCOMPATIBLE_REFERENCE = 'INCOMPATIBLE_REFERENCE',
  /**
   * Data is stored under a key that is not a field in the schema, e.g. after a field was renamed or removed.
   */
  UNKNOWN_FIELD = 'UNKNOWN_FIELD',
}

const severityByCode: Record<ViolationCode, ViolationSeverity> = {
  [ViolationCode.INVALID_SCHEMA]: ViolationSeverity.ERROR,
  [ViolationCode.UNKNOWN_ENTRY_TYPE]: ViolationSeverity.ERROR,
  [ViolationCode.INVALID_VALUE]: ViolationSeverity.ERROR,
  [ViolationCode.DANGLING_REFERENCE]: ViolationSeverity.ERROR,
  [ViolationCode.INCOMPATIBLE_REFERENCE]: ViolationSeverity.ERROR,
  [ViolationCode.UNKNOWN_FIELD]: ViolationSeverity.WARNING,
}

export interface Violation {
  severity: ViolationSeverity
  code: ViolationCode
  message: string
  /**
   * ID of the affected entry; not set for violations of the schema.
   */
  entryId?: string
  /**
   * Path of the affected value within the entry data, e.g. `['sections', 2, 'Hero', 'headline']`.
   */
  path: (string | number)[]
  /**
   * The value stored at `path`, exactly as read from the repository, e.g. an object stored for a field of type
   * `String`, or the data stored under a key that is not part of the schema. Set for every violation that concerns a
   * stored value, including `null`; not set for missing values and for violations that do not concern a single value,
   * e.g. an unknown entry type.
   */
  value?: unknown
}

export interface ValidationResult {
  /**
   * Commit hash the validation was performed on.
   */
  ref: string
  violations: Violation[]
}

/**
 * Creates a violation. `value` is only set on the violation if it is passed and not `undefined`, as `undefined`
 * stands for a missing value, which has no value to report.
 */
export function createViolation(
  code: ViolationCode,
  message: string,
  path: (string | number)[],
  details: { entryId?: string; value?: unknown } = {},
): Violation {
  const violation: Violation = {
    severity: severityByCode[code],
    code,
    message,
    path,
  }
  if (details.entryId !== undefined) {
    violation.entryId = details.entryId
  }
  if (details.value !== undefined) {
    violation.value = details.value
  }
  return violation
}

/**
 * Formats violations for an error message. Entry IDs are only included if requested, so that messages that already
 * name the single affected entry do not repeat its ID for every violation.
 */
export function formatViolations(
  violations: Violation[],
  includeEntryId: boolean,
): string {
  return violations
    .map((violation) => {
      const location = [
        ...(includeEntryId && violation.entryId !== undefined
          ? [violation.entryId]
          : []),
        ...(violation.path.length > 0 ? [violation.path.join('.')] : []),
      ].join(' ')
      return location.length > 0
        ? `${location}: ${violation.message}`
        : violation.message
    })
    .join(' ')
}
