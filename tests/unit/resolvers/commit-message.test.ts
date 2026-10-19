import { getCommitMessage } from '../../../src/graphql/resolvers/commit-message'

describe('Commit message', () => {
  it.each([
    ['omitted', undefined],
    ['null', null],
    ['empty', ''],
    ['whitespace only', ' \n\t '],
  ])(
    'should generate a message when message is %s',
    (_description, message) => {
      expect(getCommitMessage(message, 'Update', 'EntryA', 'A')).toBe(
        'Update EntryA "A"',
      )
    },
  )

  it.each([
    ['Create', 'Create EntryA "blog/2024/hello"'],
    ['Update', 'Update EntryA "blog/2024/hello"'],
    ['Delete', 'Delete EntryA "blog/2024/hello"'],
  ] as const)(
    'should generate a message for operation %s',
    (operation, expectedMessage) => {
      expect(
        getCommitMessage(undefined, operation, 'EntryA', 'blog/2024/hello'),
      ).toBe(expectedMessage)
    },
  )

  it('should keep a given message', () => {
    expect(getCommitMessage('My message', 'Update', 'EntryA', 'A')).toBe(
      'My message',
    )
  })

  it('should trim a given message', () => {
    expect(
      getCommitMessage('  My message\nwith body\n', 'Update', 'EntryA', 'A'),
    ).toBe('My message\nwith body')
  })
})
