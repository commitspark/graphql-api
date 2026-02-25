export function isRecord(obj: unknown): obj is Record<string, unknown> {
  if (typeof obj !== 'object') {
    return false
  }

  if (Array.isArray(obj)) {
    return false
  }

  return Object.getOwnPropertySymbols(obj).length === 0
}
