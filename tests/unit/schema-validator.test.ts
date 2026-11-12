import { validateSchemaDefinition } from '../../src/graphql/schema-validator'

const entryDirective = 'directive @Entry on OBJECT\n'
const productType = 'type Product @Entry { id: ID!, name: String }\n'

const getProblems = (schemaDefinition: string): string[] =>
  validateSchemaDefinition(schemaDefinition).problems

describe('Schema validator', () => {
  it('should accept a valid schema and return the built schema', () => {
    const result = validateSchemaDefinition(entryDirective + productType)

    expect(result.problems).toEqual([])
    expect(result.schema?.getType('Product')).toBeDefined()
  })

  it('should report a schema definition that cannot be parsed', () => {
    const result = validateSchemaDefinition('type Product {')

    expect(result.schema).toBeUndefined()
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toContain('Syntax Error')
  })

  it.each([
    [
      'an interface',
      'interface Named { name: String }\ntype Item implements Named { name: String }',
      'Interface "Named" is not supported; use a union instead.',
    ],
    [
      'an input type',
      'input Filter { name: String }',
      'Input type "Filter" is not supported, as Commitspark generates input types.',
    ],
    [
      'a custom scalar',
      'scalar DateTime\ntype Event { at: DateTime }',
      'Custom scalar "DateTime" is not supported; use one of the built-in scalars "String", "Int", "Float", ' +
        '"Boolean" and "ID".',
    ],
    [
      'a field with arguments',
      'type Text { content(language: String): String }',
      'Field "Text.content" has arguments, which are not supported.',
    ],
    [
      'a schema definition',
      'type Root { name: String }\nschema { query: Root }',
      'Schema definitions ("schema { ... }") are not supported, as Commitspark generates the root types.',
    ],
    [
      'a type extension',
      'extend type Product { description: String }',
      'Type extensions ("extend") of "Product" are not supported; declare the type in a single definition.',
    ],
    [
      'a directive added by a type extension',
      'type Category { id: ID! }\nextend type Category @Entry',
      'Type extensions ("extend") of "Category" are not supported; declare the type in a single definition.',
    ],
  ])('should reject a schema with %s', (_description, definitions, message) => {
    expect(getProblems(entryDirective + productType + definitions)).toEqual([
      message,
    ])
  })

  it('should accept custom directives with arguments', () => {
    const schemaDefinition =
      entryDirective +
      'directive @Ui(editor: String, visibleList: Boolean) on FIELD_DEFINITION\n' +
      'directive @Ai(instruction: String) on OBJECT | FIELD_DEFINITION\n' +
      'type Article @Entry @Ai(instruction: "Write in a friendly tone") {\n' +
      '  id: ID!\n' +
      '  title: String @Ui(visibleList: true)\n' +
      '  body: String @Ui(editor: "markdown")\n' +
      '}'

    expect(getProblems(schemaDefinition)).toEqual([])
  })

  it.each([
    [
      'a type named like the input type of another type',
      'type ProductInput { name: String }',
      'Type name "ProductInput" is reserved for the input type of type "Product"; rename the type.',
    ],
    [
      'a type named like the reference input type of an @Entry type',
      'type ProductIdInput { name: String }',
      'Type name "ProductIdInput" is reserved for the reference input type of type "Product"; rename the type.',
    ],
    [
      'a type named like the input type of a union',
      'type Hero { title: String }\nunion Block = Hero\ntype BlockInput { name: String }',
      'Type name "BlockInput" is reserved for the input type of union "Block"; rename the type.',
    ],
    [
      'a type named like the reference input type of a union of @Entry types',
      'type Page @Entry { id: ID! }\nunion Link = Product | Page\ntype LinkIdInput { name: String }',
      'Type name "LinkIdInput" is reserved for the reference input type of union "Link"; rename the type.',
    ],
    [
      'a type named like a root type',
      'type Query { name: String }',
      'Type name "Query" is reserved for a root type; rename the type.',
    ],
    [
      'a type named like a type of Commitspark',
      'type _CommitInput { message: String }',
      'Type name "_CommitInput" is reserved for a type of Commitspark; rename the type.',
    ],
    [
      'types whose generated type names collide',
      'type ProductId { value: String }',
      'Generated type name "ProductIdInput" would be used for the input type of type "ProductId" and for the ' +
        'reference input type of type "Product"; rename one of the types.',
    ],
    [
      '@Entry types whose generated query names collide',
      'type everyProduct @Entry { id: ID! }',
      'Generated query name "everyProduct" would be used for the query of all entries of type "Product" and for ' +
        'the query of a single entry of type "everyProduct"; rename one of the types.',
    ],
    [
      'an @Entry type named like a query of Commitspark',
      'type _search @Entry { id: ID! }',
      'Generated query name "_search" would be used for a query of Commitspark and for the query of a single ' +
        'entry of type "_search"; rename one of the types.',
    ],
    [
      'an @Entry type with a field named like a field added by Commitspark',
      'type Category @Entry { id: ID!, _version: Int }',
      'Field name "Category._version" is reserved for a field that Commitspark adds to every type with "@Entry" ' +
        'directive; rename the field.',
    ],
  ])('should reject a schema with %s', (_description, definitions, message) => {
    expect(getProblems(entryDirective + productType + definitions)).toEqual([
      message,
    ])
  })

  it('should accept names that only resemble generated names', () => {
    // unions of types without @Entry directive have no reference input type, so `BlockIdInput` is free
    const schemaDefinition =
      entryDirective +
      productType +
      'type Hero { title: String }\n' +
      'union Block = Hero\n' +
      'type BlockIdInput { name: String }\n' +
      'type ProductInputs { name: String }\n' +
      'type Note { _version: Int }'

    expect(getProblems(schemaDefinition)).toEqual([])
  })

  it.each([
    ['without field "id"', 'name: String'],
    ['with field "id" of type "String!"', 'id: String!'],
    ['with nullable field "id"', 'id: ID'],
  ])('should reject an @Entry type %s', (_description, fieldDefinition) => {
    expect(
      getProblems(
        entryDirective + `type MyEntry @Entry { ${fieldDefinition} }`,
      ),
    ).toEqual([
      'Type "MyEntry" must have a field "id" of type "ID!" to use "@Entry" directive.',
    ])
  })

  it('should reject a union of @Entry types and types without @Entry directive', () => {
    const schemaDefinition =
      entryDirective +
      productType +
      'type Hero { title: String }\n' +
      'union Block = Product | Hero'

    expect(getProblems(schemaDefinition)).toEqual([
      'Either all union members of "Block" must have "@Entry" directive or none.',
    ])
  })

  it('should reject @Searchable on a field that is not of type String', () => {
    const schemaDefinition =
      entryDirective +
      'directive @Searchable on OBJECT | FIELD_DEFINITION\n' +
      'type Article @Entry { id: ID!, title: String @Searchable, views: Int @Searchable }'

    expect(getProblems(schemaDefinition)).toEqual([
      'Field "Article.views" must be of type "String" or a list of "String" to use "@Searchable" directive.',
    ])
  })

  it('should report all problems of a schema', () => {
    const schemaDefinition =
      entryDirective +
      'scalar DateTime\n' +
      'type Event @Entry { name: String, at: DateTime }\n' +
      'type Venue @Entry { name: String }\n' +
      'type Text { content(language: String): String }'

    expect(getProblems(schemaDefinition)).toEqual([
      'Custom scalar "DateTime" is not supported; use one of the built-in scalars "String", "Int", "Float", ' +
        '"Boolean" and "ID".',
      'Field "Text.content" has arguments, which are not supported.',
      'Type "Event" must have a field "id" of type "ID!" to use "@Entry" directive.',
      'Type "Venue" must have a field "id" of type "ID!" to use "@Entry" directive.',
    ])
  })
})
