# Introduction

**This library is part of [Contentlab](https://contentlab.sh). It generates a fully functional CRUD GraphQL API for
structured text data exclusively from files in a Git repository.**

Queries and mutations of the generated API are determined by a plain text content model definition file inside the
repository using the standard GraphQL [type notation](https://graphql.org/learn/schema/).

Content entries are also stored in the given Git repository using plain YAML text files. No other data store is needed.

---

*Contentlab is currently in Alpha, i.e. it is not feature-complete, missing error handling and tests, and may be
changed significantly before a first stable release*

# Architecture

The Contentlab library...

* is intentionally built with a narrow feature set to facilitate composition into larger systems
* is extensible by using separate adapter packages that implement access to Git repositories
* is transport-agnostic and can be used with or without a web server (or serverless function)
* is declarative, which means the generated API structure is Git-versioned due to the underlying definition file being
  Git-versioned
* is completely stateless and for each call obtains all state from Git, ideal for use in serverless environments
* is fully headless and does _not_ offer any graphical user interface
* supports immutable content based on Git's ref addressing scheme
* is meant for working with text-like data, delegating non-text data to other systems (e.g. DAM for media assets)

# Running Contentlab

An application using Contentlab should be built with two Git repositories:

* A code repository to hold application code that exposes or uses the GraphQL API via this library
* A content repository to hold the content model definition as well as actual content entries

## Development

The quickest way to build and run your own Contentlab-based GraphQL endpoint is to clone the two example repositories:

1. Clone [this example code repository](https://github.com/contentlab-sh/example-code-serverless) and follow the
   README instructions to obtain basic pre-built serverless functions which you can run locally on a dev machine
2. Clone [this example content repository](https://github.com/contentlab-sh/example-content-multilanguage-website)
   to start with a simple schema typically used for multi-language websites which you can then adjust as desired

## Production

Since Contentlab is a transport-agnostic library, it can be wrapped in a thin serverless function (e.g. Serverless) or a
web server of choice (e.g. Express) to expose the API via HTTP.

A pre-built hosted offering that requires no code but only a content repository is coming soon.

# Working with Contentlab

## Selecting a Git adapter

For better extensibility of Contentlab, code that retrieves files from a Git repository is split out into Git adapters.
When calling the Contentlab library functions, you must pass an adapter instance of your choice.

The following adapters exist:

| Adapter                                                               | Description                                              |
|-----------------------------------------------------------------------|----------------------------------------------------------|
| [GitLab (SaaS)](https://github.com/contentlab-sh/git-adapter)         | Provides access to Git repositories hosted on gitlab.com |
| [Filesystem](https://github.com/contentlab-sh/git-adapter-filesystem) | Provides basic access to files on filesystem level       |

If you want to build your own adapter, implement the interfaces found
in [this repository](https://github.com/contentlab-sh/git-adapter).

## Picking from the Git commit tree

The Contentlab API fully supports traversing the Git commit tree by setting the `ref` argument in library calls to a

* ref (i.e. commit hash),
* branch name, or
* tag name (light or regular)

## Obtaining the generated GraphQL schema

Contentlab extends the schema defined in the schema file with additional types as well as queries and mutations. This
extended schema can be retrieved by calling `getSchema()`.

Compared to schema data obtained through GraphQL introspection, the schema returned here also includes directive
declarations and annotations, allowing for development of additional tools that require this information.

## Reading data

The `body` argument of `postGraphQL()` expects conventional GraphQL query / mutation syntax and supports introspection.
Contentlab also transparently resolves references between entries, allowing for retrieval of complex data in a single
query.

### Generated queries

For each content type annotated with `@Entry` in the content model (see below), the following queries are generated:

* Query a single entry of a type by ID, e.g. `MyType(id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"): MyType`
* Query all entries of a type, e.g. `allMyTypes: [MyType]`

## Writing data

Mutation operations work on branch names only and (when successful) each create a new commit on HEAD in the given
branch. To avoid race conditions, multiple mutations are processed sequentially (see the
[GraphQL documentation](https://graphql.org/learn/queries/#multiple-fields-in-mutations)).

### Generated queries

For each content type annotated with `@Entry` (see below), the following mutations are generated:

* Create a single entry of a type, e.g.
  `createMyType(message:"Commit message", data:{...}): MyType`
* Mutate a single entry of a type by ID, e.g.
  `updateMyType(id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", message:"Commit message", data:{...}): MyType`
* Delete a single entry of a type by ID, e.g.
  `deleteMyType(id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", message:"Commit message"): { id }`

# Technical documentation

## Content model

The content model (i.e. schema) is defined in a single GraphQL type definition text file using the
[GraphQL type system](https://graphql.org/learn/schema/).

The schema file must be located at `schema/schema.graphql` inside the Git repository.

Contentlab currently supports the following data types:

* `type`
* `union`
* `enum`

### Content entries

To denote which content type instances are to be given a unique identity for referencing, a directive `@Entry` is
to be declared (this must be done right in the schema file so that the schema remains valid).

To define the `@Entry` directive, simply add this line to the schema file:

```graphql
directive @Entry on OBJECT
```

To promote a content type to Entry, annotate the type as follows:

```graphql
type MyType @Entry {
    id: ID!
    # ...
}
```

**Important:** Any type annotated with `@Entry` must have a field `id` of type `ID!`.

**Note:** Only apply `@Entry` to content types that you actually want to reference or link to from other entries. This
keeps the number of entries low and performance up.

## Content storage

Content entries, i.e. instances of content types annotated with `@Entry`, are stored as `.yaml` YAML text files inside
a folder `entries` in the repository.

The filename (excluding file extension) constitutes the entry ID and is generated as a UUID4 string by Contentlab.

Entry files have the following structure:

```yaml
metadata:
    type: MyType # name of type as defined in your schema
data:
#   ... fields of the type as defined in your schema
```

### Serialization

References to types annotated with `@Entry` are stored using a sub-field `id`.

For example, consider the following schema:

```graphql
type Page @Entry {
    id: ID!
}

type Link @Entry {
    target: Page
}
```

An entry for `Link` referencing a `Page` will look like this:

```yaml
metadata:
    type: Link
data:
    target:
        id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa # ID of targeted Page
```

# FAQ

* Q: Do I need to run a web server or serverless function to use Contentlab?

  A: No. You can pass a GraphQL request string directly to the Contentlab library without going through HTTP. This can
  be useful e.g. in CI/CD pipelines where you might not want to bring up a server just to execute a GraphQL query.

* Q: Do I really need to have two separate repositories for application code and content?

  A: No. You can have both in the same repository but depending on how your software and content workflows are
  structured, you may have a hard time finding a workflow that works equally well for both domains.

# License

The code in this repository is licensed under the permissive ISC license (see [LICENSE](LICENSE)).
