import { EntryData } from '@commitspark/git-adapter'

export function isEntryData(obj: unknown): obj is EntryData {
  if (typeof obj !== 'object') {
    return false
  }

  if (Array.isArray(obj)) {
    return false
  }

  return Object.getOwnPropertySymbols(obj).length === 0
}
