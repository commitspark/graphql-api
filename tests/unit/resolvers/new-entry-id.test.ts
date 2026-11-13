import { assertValidNewEntryId } from '../../../src/graphql/resolvers/new-entry-id'

describe('New entry ID validation', () => {
  it.each([
    'a',
    'Ada Lovelace',
    'news/2026/release',
    'CON',
    'café',
    'v1.0/notes',
    'a.b',
  ])('should accept "%s"', (id) => {
    expect(() => assertValidNewEntryId(id)).not.toThrow()
  })

  it.each([
    ['a decomposed character', 'café'],
    ['a segment ending with "."', 'draft.'],
    ['a folder segment ending with "."', 'news./a'],
    ['a segment ending with a space', 'draft '],
    ['a folder segment ending with a space', 'news /a'],
    ['invalid characters', 'a:b'],
    ['an empty segment', 'a//b'],
    ['a hidden segment', '.a'],
  ])('should reject an ID with %s', (_description, id) => {
    expect(() => assertValidNewEntryId(id)).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({
          code: 'BAD_USER_INPUT',
          commitspark: { argumentName: 'id', argumentValue: id },
        }),
      }),
    )
  })
})
