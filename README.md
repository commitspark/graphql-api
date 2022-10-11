# Introduction
**This library is part of [Contentlab](https://contentlab.sh). It generates a fully functional GraphQL content
management API exclusively from data in a Git repository.**

The exact API structure is determined by the content model which is defined in a plain GraphQL text file
inside the repository using the standard GraphQL [type system](https://graphql.org/learn/schema/).

Content entries are also stored in the given Git repository using plain YAML text files. No other data store is
needed.

---

*Contentlab is currently in Alpha, i.e. it is missing functionality, error handling, and tests and may be changed
significantly before a first stable release*

# Design choices

Contentlab is intentionally built with a very narrow feature set to facilitate composition into larger systems.

Contentlab...
* is declarative and builds its GraphQL API from a single GraphQL type definition text file
* is completely stateless and for each call obtains all state from Git, ideal for use in serverless environments
* is fully headless and does _not_ offer any graphical user interface
* supports immutable content based on Git's ref addressing scheme
* does _not_ contain any authentication mechanism as this is better handled elsewhere (e.g. Lambda authorizers)
* only stores text-like data as there are specialized systems for non-text data (e.g. DAM for media assets)

# Running Contentlab

An application using Contentlab should be built with two Git repositories:
* A code repository to hold the application code
* A content repository to hold the content model (schema) and content entries

## Development

The quickest way to build and run your own Contentlab-based CMS is to clone the two example repositories:

1. Clone [this example code repository](https://github.com/contentlab-sh/example-code-serverless) and follow the
   README instructions to obtain simple pre-built serverless functions
2. Clone [this example content repository](https://github.com/contentlab-sh/example-content-multilanguage-website)
   to start with a simple schema typically used for multi-language websites which you can then adjust as desired

## Production

To deploy, adjust Serverless in your code repository to your needs or use the Contentlab hosted offering (coming soon).

# Working with Contentlab

## Selecting a Git commit

The Contentlab API fully supports traversing the Git commit tree by setting `{ref}` in API URLs to a
* ref (i.e. commit hash),
* branch name, or
* tag name (light or regular)

## Querying the generated schema

Contentlab extends the user-defined schema with additional types as well as queries and mutations. This extended
schema can be retrieved with a `GET` request to `/{ref}/schema`.

Compared to schema data obtained through GraphQL introspection, the schema returned here also includes directive
declarations and annotations, allowing for development of additional tools that require this information.

## Querying content

The Contentlab GraphQL API `/{ref}/graphql` is a conventional GraphQL API that supports introspection. The API also
transparently resolves references between entries, allowing for retrieval of complex data in a single query.

### Generated queries

For each content type annotated with `@Entry` (see below), the following queries are generated:

* Query a single entry of a type by ID, e.g. `MyType(id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")`
* Query all entries of a type, e.g. `allMyTypes`

## Managing content

Mutation operations work on branch names only and (when successful) each create a new commit on HEAD in the given
branch. To avoid race conditions, multiple mutations are processed sequentially (see the 
[GraphQL documentation](https://graphql.org/learn/queries/#multiple-fields-in-mutations)).

### Generated queries

For each content type annotated with `@Entry` (see below), the following mutations are generated:

* Mutate a single entry of a type by ID, e.g.
  `updateMyType(id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", message:"Commit message", data:{...})`
* Delete a single entry of a type by ID, e.g.
  `deleteMyType(id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", message:"Commit message")`

## Publishing content

The easiest way to understand workflows in Contentlab is by thinking of content as code. In this sense, like in
software development, content is considered "published" when it is present in a specific branch of your choice. 

"Publishing content" therefore means adding one or more content commits to your "published" branch. Together with merge
requests and CI/CD pipelines, complex workflows can be built. For example, you can configure your Git platform 
to require merge request approval by a person while also running a QA validation script that needs to pass before
content can be merged into the "published" branch.

## Migrating content

Content can be migrated in two ways:

1. Following the expand & contract pattern (add new fields to schema, move data to new fields via Contentlab API,
   delete old fields from schema)
2. By modifying the schema and YAML content files directly in a Git branch, completely outside Contentlab

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
    # ... fields of the type as defined in your schema
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

# License

The code in this repository is licensed under the permissive ISC license (see [LICENSE](LICENSE)).
