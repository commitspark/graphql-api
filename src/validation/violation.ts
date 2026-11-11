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
}

export interface ValidationResult {
  /**
   * Commit hash the validation was performed on.
   */
  ref: string
  violations: Violation[]
}

export function createViolation(
  code: ViolationCode,
  message: string,
  path: (string | number)[],
  entryId?: string,
): Violation {
  const violation: Violation = {
    severity: severityByCode[code],
    code,
    message,
    path,
  }
  if (entryId !== undefined) {
    violation.entryId = entryId
  }
  return violation
}
