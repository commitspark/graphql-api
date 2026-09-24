import { makeExecutableSchema } from '@graphql-tools/schema'
import { Entry } from '@commitspark/git-adapter'
import { extractSearchableFieldValues } from '../../../src/graphql/schema-utils/searchable-field-util'

const directives = `directive @Entry on OBJECT
directive @Searchable on OBJECT | FIELD_DEFINITION
`

const createEntry = (
  id: string,
  type: string,
  data: Record<string, unknown>,
): Entry => ({ id: id, metadata: { type: type }, data: data })

describe('Searchable field value extraction', () => {
  it('should extract only fields with directive on field level', () => {
    const schema = makeExecutableSchema({
      typeDefs: `${directives}
type Article @Entry {
  id: ID!
  title: String @Searchable
  url: String
}`,
    })

    const values = extractSearchableFieldValues(schema, [
      createEntry('a1', 'Article', { title: 'Hello', url: 'https://x' }),
    ])

    expect(values).toEqual([
      {
        entryId: 'a1',
        entryType: 'Article',
        fieldPath: 'title',
        value: 'Hello',
      },
    ])
  })

  it('should extract all String fields of a type with directive on type level', () => {
    const schema = makeExecutableSchema({
      typeDefs: `${directives}
enum Status { DRAFT }
type Article @Entry @Searchable {
  id: ID!
  title: String
  subtitle: String!
  views: Int
  status: Status
}`,
    })

    const values = extractSearchableFieldValues(schema, [
      createEntry('a1', 'Article', {
        title: 'Hello',
        subtitle: 'World',
        views: 3,
        status: 'DRAFT',
      }),
    ])

    expect(values.map((document) => document.fieldPath)).toEqual([
      'title',
      'subtitle',
    ])
  })

  it('should extract nested fields only where the nested type or field has the directive', () => {
    const schema = makeExecutableSchema({
      typeDefs: `${directives}
type Article @Entry @Searchable {
  id: ID!
  seo: Seo
  meta: Meta
}
type Seo @Searchable {
  description: String
}
type Meta {
  author: String @Searchable
  internalNote: String
}`,
    })

    const values = extractSearchableFieldValues(schema, [
      createEntry('a1', 'Article', {
        seo: { description: 'SEO text' },
        meta: { author: 'Jane', internalNote: 'hidden' },
      }),
    ])

    expect(values).toEqual([
      {
        entryId: 'a1',
        entryType: 'Article',
        fieldPath: 'seo.description',
        value: 'SEO text',
      },
      {
        entryId: 'a1',
        entryType: 'Article',
        fieldPath: 'meta.author',
        value: 'Jane',
      },
    ])
  })

  it('should extract list items with their index in the field path', () => {
    const schema = makeExecutableSchema({
      typeDefs: `${directives}
type Article @Entry {
  id: ID!
  tags: [String!] @Searchable
  sections: [Section!]!
}
type Section @Searchable {
  body: String
}`,
    })

    const values = extractSearchableFieldValues(schema, [
      createEntry('a1', 'Article', {
        tags: ['one', 'two'],
        sections: [{ body: 'First' }, { body: 'Second' }],
      }),
    ])

    expect(values.map((document) => document.fieldPath)).toEqual([
      'tags[0]',
      'tags[1]',
      'sections[0].body',
      'sections[1].body',
    ])
  })

  it('should not follow references to other entries', () => {
    const schema = makeExecutableSchema({
      typeDefs: `${directives}
type Article @Entry @Searchable {
  id: ID!
  title: String
  author: Author
  related: [Related!]
}
type Author @Entry @Searchable {
  id: ID!
  name: String
}
union Related = Article | Author`,
    })

    const values = extractSearchableFieldValues(schema, [
      createEntry('a1', 'Article', {
        title: 'Hello',
        author: { id: 'au1' },
        related: [{ id: 'au1' }],
      }),
      createEntry('au1', 'Author', { name: 'Jane' }),
    ])

    expect(values).toEqual([
      {
        entryId: 'a1',
        entryType: 'Article',
        fieldPath: 'title',
        value: 'Hello',
      },
      { entryId: 'au1', entryType: 'Author', fieldPath: 'name', value: 'Jane' },
    ])
  })

  it('should extract fields of non-entry union values', () => {
    const schema = makeExecutableSchema({
      typeDefs: `${directives}
type Page @Entry {
  id: ID!
  blocks: [Block!]
}
union Block = TextBlock | ImageBlock
type TextBlock @Searchable {
  body: String
}
type ImageBlock {
  caption: String @Searchable
  url: String
}`,
    })

    const values = extractSearchableFieldValues(schema, [
      createEntry('p1', 'Page', {
        blocks: [
          { TextBlock: { body: 'Text' } },
          { ImageBlock: { caption: 'Caption', url: 'https://x' } },
        ],
      }),
    ])

    expect(values.map((document) => document.fieldPath)).toEqual([
      'blocks[0].TextBlock.body',
      'blocks[1].ImageBlock.caption',
    ])
  })

  it('should skip empty values, missing data and values not matching the schema', () => {
    const schema = makeExecutableSchema({
      typeDefs: `${directives}
type Article @Entry @Searchable {
  id: ID!
  title: String
  subtitle: String
  tags: [String]
  seo: Seo
}
type Seo @Searchable {
  description: String
}`,
    })

    const values = extractSearchableFieldValues(schema, [
      createEntry('a1', 'Article', {
        title: '  ',
        subtitle: null,
        tags: 'not a list',
        seo: 'not an object',
      }),
      { id: 'a2', metadata: { type: 'Article' } },
      createEntry('x1', 'UnknownType', { title: 'Unknown' }),
    ])

    expect(values).toEqual([])
  })
})
