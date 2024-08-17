# Introduction

[Commitspark](https://commitspark.com) is a set of tools to manage structured data with Git through a GraphQL API.

This library dynamically generates the GraphQL API that allows reading and writing structured data (entries) to and from
a Git repository.

Queries and mutations offered by the generated API are determined by a standard GraphQL type definition file (schema)
inside the Git repository.

Entries (data) are stored using plain YAML text files in the same Git repository. No other data store is needed.

# Running the GraphQL API

There are two common ways to run this library:

1. By making GraphQL calls directly against the library as a code dependency in your own JavaScript / TypeScript /
   NodeJS application (NPM package name `@commitspark/graphql-api`)
2. By making GraphQL calls over HTTP to the library wrapped in a webserver or Lambda function of choice
   (see the [NodeJS Express server example](https://github.com/commitspark/example-http-express) or
   [Lambda function example](https://github.com/commitspark/example-code-serverless))

# Git repository hosting

This library follows an adapter pattern to allow reading from and writing to Git repositories in various locations,
either hosted or locally. When calling the library, pass an adapter instance as needed by your project.

The following pre-built adapters exist:

| Adapter                                                             | Description                                                | NPM package name                      |
|---------------------------------------------------------------------|------------------------------------------------------------|---------------------------------------|
| [GitHub](https://github.com/commitspark/git-adapter-github)         | Provides access to Git repositories hosted on github.com   | `@commitspark/git-adapter-github`     |
| [GitLab (SaaS)](https://github.com/commitspark/git-adapter-gitlab)  | Provides access to Git repositories hosted on gitlab.com   | `@commitspark/git-adapter-gitlab`     |
| [Filesystem](https://github.com/commitspark/git-adapter-filesystem) | Provides read-only access to files on the filesystem level | `@commitspark/git-adapter-filesystem` |

In case you want to build your own adapter, implement the interfaces found
in [this repository](https://github.com/commitspark/git-adapter).

# Making GraphQL calls

## Picking from the Git tree

As Commitspark is Git-based, all queries and mutations support traversing the Git commit tree by setting the `ref`
argument in library calls to a

* ref (i.e. commit hash),
* branch name, or
* tag name (light or regular)

This enables great flexibility, e.g. to retrieve always the same entries of a specific (historic) commit, to have
different branches with different entries, or to retrieve entries by tag such as one that marks the latest approved
data in a repository.

## Obtaining the generated GraphQL schema

At runtime, Commitspark dynamically extends the GraphQL schema found in the schema file with additional
types as well as queries and mutations. This extended schema can be retrieved by calling `getSchema()`.

Compared to schema data obtained through GraphQL introspection, the schema returned by this function also includes
directive declarations and annotations, allowing for development of additional tools that require this information.

## Reading data

The `request` argument of `postGraphQL()` expects a conventional GraphQL query and supports query variables as well as
introspection. Commitspark also transparently resolves references to other @Entry-annotated GraphQL types (see below),
allowing for retrieval of complex data in a single query as nested result data.

### Generated queries

For each GraphQL type annotated with `@Entry` in the schema (see below), e.g. `MyType`, the following queries are
generated:

* Query a single entry of a type by ID, e.g. `MyType(id: "..."): MyType`
* Query all entries of a type, e.g. `allMyTypes: [MyType]`

## Writing data

The `request` argument of `postGraphQL()` expects a conventional GraphQL mutation and supports mutation variables as
well as introspection. Mutation operations work on branch names only and (when successful) each append a new commit on
HEAD in the given branch. To avoid race conditions, mutations in calls with multiple mutations are processed
sequentially (see the [GraphQL documentation](https://graphql.org/learn/queries/#multiple-fields-in-mutations)).

### Generated mutations

For each GraphQL type annotated with `@Entry` (see below), the following mutations are generated:

* Create a single entry of a type, e.g.
  `createMyType(id: "...", message: "Commit message", data: {...}): MyType`
* Mutate a single entry of a type by ID, e.g.
  `updateMyType(id: "...", message: "Commit message", data: {...}): MyType`
* Delete a single entry of a type by ID, e.g.
  `deleteMyType(id: "...", message: "Commit message"): { id }`

# Technical documentation

## Data model

The data model (i.e. schema) is defined in a single GraphQL type definition text file using the
[GraphQL type system](https://graphql.org/learn/schema/).

The schema file must be located at `commitspark/schema/schema.graphql` inside the Git repository (unless otherwise
configured in your Git adapter).

Commitspark currently supports the following GraphQL types:

* `type`
* `union`
* `enum`

### Data entries

To denote which data is to be given a unique identity for referencing, a directive `@Entry` is
to be declared (this must be done right in the schema file so that the schema remains valid).

To define the `@Entry` directive, simply add this line to the schema file:

```graphql
directive @Entry on OBJECT
```

To promote a data type to Entry, annotate the type as follows:

```graphql
type MyType @Entry {
    id: ID!
    # ...
}
```

**Important:** Any type annotated with `@Entry` must have a field `id` of type `ID!`.

**Note:** Only apply `@Entry` to data types that you actually want to reference or link to from other entries. This
keeps the number of entries low and performance up.

## Entry storage

Entries, i.e. instances of data types annotated with `@Entry`, are stored as `.yaml` YAML text files inside
a folder `commitspark/entries/` in the repository (unless otherwise configured in your Git adapter).

The filename (excluding file extension) constitutes the entry ID.

Entry files have the following structure:

```yaml
metadata:
  type: MyType # name of type as defined in your schema
  referencedBy: [ ] # array of entry IDs that hold a reference to this entry
data:
#   ... fields of the type as defined in your schema
```

### Serialization

#### References

References to types annotated with `@Entry` are stored using a sub-field `id`.

For example, consider the following schema:

```graphql
type Page @Entry {
    id: ID!
}

type Link @Entry {
    id: ID!
    target: Page
}
```

An entry YAML file for a `Link` with ID `myLink` referencing a `Page` with ID `myPage` will look like this:

```yaml
metadata:
  type: Link
  referencedBy: [ ]
data:
  target:
    id: myPage
```

The entry YAML file of referenced `Page` `myPage` will then look like this:

```yaml
metadata:
  type: Page
  referencedBy:
    - myLink
data: ~
```

#### Unions

Consider the following schema where field `contentElements` is an array of Union type `ContentElement`, allowing
different concrete types `Hero` or `Text` to be applied:

```graphql
type Page @Entry {
  id: ID!
  contentElements: [ContentElement!]
}

union ContentElement =
  | Hero
  | Text

type Hero {
  heroText: String!
}

type Text {
  bodyText: String!
}
```

During serialization, concrete type instances are represented through an additional nested level of data, using the
instance's type name with a lowercase first character as field name:

```yaml
metadata:
  type: Page
  referencedBy: [ ]
data:
  contentElements:
    - hero: # represents type `Hero`
        heroText: "..."
    - text: # represents type `Text`
        bodyText: "..."
```

When querying data through the API, this additional level of nesting is transparently removed and not visible.

# License

The code in this repository is licensed under the permissive ISC license (see [LICENSE](LICENSE)).
