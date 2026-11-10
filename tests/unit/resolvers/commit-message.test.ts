import { getCommitMessage } from '../../../src/graphql/resolvers/commit-message'

describe('Commit message', () => {
  it.each([
    ['commit omitted', undefined],
    ['commit null', null],
    ['message omitted', {}],
    ['message null', { message: null }],
    ['message empty', { message: '' }],
    ['message whitespace only', { message: ' \t ' }],
  ])('should generate a message when %s', (_description, commit) => {
    expect(getCommitMessage(commit, 'Update', 'EntryA', 'A')).toEqual({
      message: 'Update EntryA "A"',
    })
  })

  it.each([
    ['Create', 'Create EntryA "blog/2024/hello"'],
    ['Update', 'Update EntryA "blog/2024/hello"'],
    ['Delete', 'Delete EntryA "blog/2024/hello"'],
  ] as const)(
    'should generate a message for operation %s',
    (operation, expectedMessage) => {
      expect(
        getCommitMessage(undefined, operation, 'EntryA', 'blog/2024/hello'),
      ).toEqual({ message: expectedMessage })
    },
  )

  it('should trim a given message', () => {
    expect(
      getCommitMessage({ message: '  My message \n' }, 'Update', 'EntryA', 'A'),
    ).toEqual({ message: 'My message' })
  })

  it('should trim a given body and keep its line breaks', () => {
    expect(
      getCommitMessage(
        { message: 'My message', body: '\n Line 1\n\nLine 2 \n' },
        'Update',
        'EntryA',
        'A',
      ),
    ).toEqual({ message: 'My message', body: 'Line 1\n\nLine 2' })
  })

  it.each([
    ['omitted', undefined],
    ['null', null],
    ['whitespace only', ' \n '],
  ])('should omit a body that is %s', (_description, body) => {
    expect(
      getCommitMessage(
        { message: 'My message', body },
        'Update',
        'EntryA',
        'A',
      ),
    ).toEqual({ message: 'My message' })
  })

  it('should keep a body when the message is generated', () => {
    expect(
      getCommitMessage({ body: 'Details' }, 'Update', 'EntryA', 'A'),
    ).toEqual({ message: 'Update EntryA "A"', body: 'Details' })
  })

  it.each([
    ['LF', 'My message\nDetails'],
    ['CRLF', 'My message\r\nDetails'],
    ['CR', 'My message\rDetails'],
  ])(
    'should reject a message containing a line break (%s)',
    (_description, message) => {
      expect(() =>
        getCommitMessage({ message }, 'Update', 'EntryA', 'A'),
      ).toThrow(
        expect.objectContaining({
          extensions: {
            code: 'BAD_USER_INPUT',
            commitspark: {
              argumentName: 'commit.message',
              argumentValue: message,
            },
          },
        }),
      )
    },
  )
})
