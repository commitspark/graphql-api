# Introduction

**This library dynamically generates a GraphQL API that allows reading and writing structured text content to and from a
Git repository.**

Queries and mutations offered by the generated API are determined by a vanilla GraphQL type definition file inside the
Git repository.

Content is stored using plain YAML text files in the same Git repository. No other data store or configuration is
needed.

---

*Commitspark is in tech-preview, i.e. it is not yet feature-complete, missing some error handling and tests, and may
implement breaking changes before a first production-ready release.*

# Usage

Use this library to query structured content from a Git repository via GraphQL e.g. in order to fill frontends such as a
Next.js-based website with content. The generated GraphQL API is similar to those offered by headless content management
systems (CMS), only that content comes from a Git repository and not a proprietary storage or API.

To edit content, either use the [Commitspark user interface](https://commitspark.com) or execute the library's generated
GraphQL mutations yourself. (Or if you know what you're doing, you could even edit the YAML content files directly in a
repository).

To change the content model, simply modify the GraphQL type definition (schema) file. For details, see below.

# Running the Commitspark library

There are two common ways to run this library:

1. By making GraphQL calls directly against the library as a code dependency in your own JavaScript / TypeScript /
   NodeJS application (NPM package name `@commitspark/graphql-api`)
2. By making GraphQL calls over HTTP to the library wrapped in
   a webserver or Lambda function of choice
   ([NodeJS Express server example](https://github.com/commitspark/example-http-express),
   [Lambda function example](https://github.com/commitspark/example-code-serverless))

In both cases, it is recommended to use a dedicated Git repository for content and not use the same repository as used
for application code. See "Git repository hosting" below on where this content repository can be located.

# Getting started

If you're new to Commitspark, the quickest way to see Commitspark in action is as follows:

1. [Copy the example Git content repository](https://github.com/commitspark/example-content-website/generate)
2. [Copy the example Next.js application repository](https://github.com/commitspark/example-nextjs/generate)
3. In the application repository, follow the simple
   [README](https://github.com/commitspark/example-nextjs/blob/main/README.md) steps to point Next.js to your content
   repository

# Git repository hosting

Commitspark follows an adapter pattern, so it can read from and write to Git repositories in various places, either
hosted or locally. When using the library, pass an adapter instance as needed by your project.

The following adapters exist:

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

This enables great flexibility, e.g. to retrieve always the same content of a specific (historic) commit, to have
different branches with different content, or to retrieve content by tag such as reviewed content.

## Obtaining the generated GraphQL schema

Commitspark dynamically extends the GraphQL schema file's content model at runtime with additional types as well as
queries and mutations. This extended schema can be retrieved by calling `getSchema()`.

Compared to schema data obtained through GraphQL introspection, the schema returned here also includes directive
declarations and annotations, allowing for development of additional tools that require this information.

## Reading data

The `request` argument of `postGraphQL()` expects a conventional GraphQL query and supports query variables as well as
introspection. Commitspark also transparently resolves references between @Entry-annotated content entries (see below),
allowing for retrieval of complex data in a single query.

### Generated queries

For each content type annotated with `@Entry` in the content model (see below), the following queries are generated:

* Query a single entry of a type by ID, e.g. `MyType(id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"): MyType`
* Query all entries of a type, e.g. `allMyTypes: [MyType]`

## Writing data

The `request` argument of `postGraphQL()` expects a conventional GraphQL mutation and supports mutation variables as
well as introspection. Mutation operations work on branch names only and (when successful) each append a new commit on
HEAD in the given branch. To avoid race conditions, mutations in calls with multiple mutations are processed
sequentially (see the [GraphQL documentation](https://graphql.org/learn/queries/#multiple-fields-in-mutations)).

### Generated queries

For each content type annotated with `@Entry` (see below), the following mutations are generated:

* Create a single entry of a type, e.g.
  `createMyType(message:"Commit message", data:{...}): MyType`
* Mutate a single entry of a type by ID, e.g.
  `updateMyType(id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", message:"Commit message", data:{...}): MyType`
* Delete a single entry of a type by ID, e.g.
  `deleteMyType(id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", message:"Commit message"): { id }`

## Authenticating with your repository

Depending on the Git adapter used (see above), an authentication token must be provided. See the corresponding adapter
README for details.

# Technical documentation

## Content model

The content model (i.e. schema) is defined in a single GraphQL type definition text file using the
[GraphQL type system](https://graphql.org/learn/schema/).

The schema file must be located at `schema/schema.graphql` inside the Git repository.

Commitspark currently supports the following data types:

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

The filename (excluding file extension) constitutes the entry ID and is generated as a UUID4 string by Commitspark.

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

* Q: Do I need to run a web server or serverless function to use Commitspark?

  A: No. You can pass a GraphQL request string directly to the Commitspark library without going through HTTP. This can
  be useful e.g. in CI/CD pipelines where you might not want to bring up a server just to execute a GraphQL query.

* Q: Do I really need to have two separate repositories for application code and content?

  A: No. You can have both in the same repository but depending on how your software and content workflows are
  structured, you may have a hard time finding a workflow that works equally well for both domains.

# License

The code in this repository is licensed under the permissive ISC license (see [LICENSE](LICENSE)).
