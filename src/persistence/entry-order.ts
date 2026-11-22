/**
 * Compares entry IDs by Unicode code point, which is the same order as comparing their UTF-8 bytes, as Git does for
 * paths. JavaScript's default string comparison uses UTF-16 code units instead, which orders characters above U+FFFF
 * before characters in the range U+E000 to U+FFFF.
 */
export function compareEntryIds(a: string, b: string): number {
  let index = 0
  while (index < a.length && index < b.length) {
    const codePointA = a.codePointAt(index) as number
    const codePointB = b.codePointAt(index) as number
    if (codePointA !== codePointB) {
      return codePointA - codePointB
    }
    index += codePointA > 0xffff ? 2 : 1
  }
  return a.length - b.length
}
