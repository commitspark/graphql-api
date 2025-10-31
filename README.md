# Introduction

[Commitspark](https://commitspark.com) is a set of tools to manage structured data with Git through a GraphQL API.

The library found in this repository provides the GraphQL API that allows reading and writing structured data (entries)
from and to a Git repository.

Queries and mutations offered by the API are determined by a standard GraphQL type definition file (schema) inside the
Git repository.

Entries (data) are stored using plain YAML text files in the same Git repository. No other data store is needed.

# Installation

There are two common ways to use this library:

1. By making GraphQL calls directly to the library as a code dependency in your own JavaScript / TypeScript /
   Node.js application.

   To do this, simply install the library with

   ```shell
   npm i @commitspark/graphql-api
   ```
2. By making GraphQL calls over HTTP to this library wrapped in a webserver or Lambda function of choice.

   Please see the [Node.js Express server example](https://github.com/commitspark/example-http-express)
   or [Lambda function example](https://github.com/commitspark/example-code-serverless) for details.

## Installing Git provider support

This library is agnostic to where a Git repository is stored and relies on separate adapters for repository access. To
access a Git repository, use one of the pre-built adapters listed below or build your own using the interfaces
in [this repository](https://github.com/commitspark/git-adapter).

| Adapter                                                             | Description                                                | Install with                                |
|---------------------------------------------------------------------|------------------------------------------------------------|---------------------------------------------|
| [GitHub](https://github.com/commitspark/git-adapter-github)         | Provides support for Git repositories hosted on github.com | `npm i @commitspark/git-adapter-github`     |
| [GitLab (SaaS)](https://github.com/commitspark/git-adapter-gitlab)  | Provides support for Git repositories hosted on gitlab.com | `npm i @commitspark/git-adapter-gitlab`     |
| [Filesystem](https://github.com/commitspark/git-adapter-filesystem) | Provides read-only access to files on the filesystem level | `npm i @commitspark/git-adapter-filesystem` |

# Building your GraphQL API

Commitspark builds a GraphQL data management API with create, read, update, and delete (CRUD) functionality that is
solely driven by data types you define in a standard GraphQL schema file in your Git repository.

Commitspark achieves this by extending the types in your schema file at runtime with queries, mutations, and additional
helper types.

Let's assume you want to manage information about rocket flights and have already defined the following simple GraphQL
schema in your Git repository:

```graphql
# commitspark/schema/schema.graphql

directive @Entry on OBJECT

type RocketFlight @Entry {
    id: ID!
    vehicleName: String!
    payloads: [Payload!]
}

type Payload {
    weight: Int!
}
```

At runtime, when sending a GraphQL request to Commitspark, these are the queries, mutations and helper types that are
added by Commitspark to your schema for the duration of request execution:

```graphql
schema {
    query: Query
    mutation: Mutation
}

type Query {
    allRocketFlights: [RocketFlight!]
    RocketFlight(id: ID!): RocketFlight
    _typeName(id: ID!): String
}

type Mutation {
    createRocketFlight(id: ID!, data: RocketFlightInput!, commitMessage: String): RocketFlight
    updateRocketFlight(id: ID!, data: RocketFlightInput!, commitMessage: String): RocketFlight
    deleteRocketFlight(id: ID!, commitMessage: String): ID
}

input RocketFlightInput {
    vehicleName: String!
    payloads: [PayloadInput!]
}

input PayloadInput {
    weight: Int!
}
```

# Making GraphQL calls

Let's now assume your repository is located on GitHub and you want to query for a single rocket flight.

The code to do so could look like this:

```typescript
import {
    createAdapter,
    GitHubRepositoryOptions,
} from '@commitspark/git-adapter-github'
import {getClient} from '@commitspark/graphql-api'

const gitHubAdapter = createAdapter()
await gitHubAdapter.setRepositoryOptions({
    repositoryOwner: process.env.GITHUB_REPOSITORY_OWNER,
    repositoryName: process.env.GITHUB_REPOSITORY_NAME,
    accessToken: process.env.GITHUB_ACCESS_TOKEN,
} as GitHubRepositoryOptions)

const client = await getClient()

const response = await client.postGraphQL(
    gitHubAdapter,
    process.env.GIT_BRANCH ?? 'main',
    {
        query: `query ($rocketFlightId: ID!) {
          rocketFlight: RocketFlight(id: $rocketFlightId) {
            vehicleName
            payloads {
              weight
            }
          }
        }`,
        variables: {
            rocketFlightId: 'VA256',
        }
    },
)

const rocketFlight = response.data.rocketFlight
// ...
```

# Technical documentation

## API

### Client

#### postGraphQL()

This function is used to make GraphQL requests.

Request execution is handled by ApolloServer behind the scenes.

Argument `request` expects a conventional GraphQL query and supports query variables as well as introspection.

#### getSchema()

This function allows retrieving the GraphQL schema extended by Commitspark as a string.

Compared to schema data obtained through GraphQL introspection, the schema returned by this function also includes
directive declarations and annotations, allowing for development of additional tools that require this information.

## Picking from the Git tree

As Commitspark is Git-based, all GraphQL requests support traversing the Git commit tree by setting the `ref` argument
in library calls to a

* ref (i.e. commit hash),
* branch name, or
* tag name (light or regular)

This enables great flexibility, e.g. to use branches in order to enable data (entry) development workflows, to retrieve
a specific (historic) commit where it is guaranteed that entries are immutable, or to retrieve entries by tag such as
one that marks the latest reviewed and approved version in a repository.

### Writing data

Mutation operations work on branch names only and (when successful) each append a new commit on
HEAD in the given branch.

To guarantee deterministic results, mutations in calls with multiple mutations are processed sequentially (see
the [official GraphQL documentation](https://graphql.org/learn/queries/#multiple-fields-in-mutations) for details).

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

To denote which data is to be given a unique identity for referencing, Commitspark expects type annotation with
directive `@Entry`:

```graphql
directive @Entry on OBJECT # Important: You must declare this for your schema to be valid

type MyType @Entry {
    id: ID! # Important: Any type annotated with `@Entry` must have such a field
    # ...
}
```

**Note:** As a general guideline, you should only apply `@Entry` to data types that meet one of the following
conditions:

* You want to independently create and query instances of this type
* You want to reference or link to an instance of such a type from multiple other entries

This keeps the number of entries low and performance up.

## Entry storage

Entries, i.e. instances of data types annotated with `@Entry`, are stored as `.yaml` YAML text files inside
folder `commitspark/entries/` in the given Git repository (unless otherwise configured in your Git adapter).

The filename (excluding file extension) constitutes the entry ID.

Entry files have the following structure:

```yaml
metadata:
  type: MyType # name of type as defined in your schema
  referencedBy: [ ] # array of entry IDs that hold a reference to this entry
data:
#   ... fields of the type as defined in your schema
```

### Serialization / Deserialization

#### References

References to types annotated with `@Entry` are serialized using a sub-field `id`.

For example, consider this variation of our rocket flight schema above:

```graphql
type RocketFlight @Entry {
    id: ID!
    operator: Operator
}

type Operator @Entry {
    id: ID!
    fullName: String!
}
```

An entry YAML file for a `RocketFlight` with ID `VA256` referencing an `Operator` with ID `Arianespace` will look
like this:

```yaml
# commitspark/entries/VA256.yaml
metadata:
  type: RocketFlight
  referencedBy: [ ]
data:
  operator:
    id: Arianespace
```

The YAML file of referenced `Operator` with ID `Arianespace` will then look like this:

```yaml
# commitspark/entries/Arianespace.yaml
metadata:
  type: Operator
  referencedBy:
    - VA256
data:
  fullName: Arianespace SA
```

When this data is deserialized, Commitspark transparently resolves references to other `@Entry` instances, allowing for
retrieval of complex, linked data in a single query such as this one:

```graphql
query {
    RocketFlight(id: "VA256") {
        id
        operator {
            fullName
        }
    }
}
```

This returns the following data:

```json
{
  "id": "VA256",
  "operator": {
    "fullName": "Arianespace SA"
  }
}
```

#### Unions

Consider this example of a schema for storing content for a marketing website built out of modular content elements,
where field `contentElements` is an array of Union type `ContentElement`, allowing different concrete types `Hero` or
`Text` to be applied:

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
concrete instance's type name as field name:

```yaml
metadata:
  type: Page
  referencedBy: [ ]
data:
  contentElements:
    - Hero:
        heroText: "..."
    - Text:
        bodyText: "..."
```

When querying data through the API, this additional level of nesting is transparently removed and not visible.

# License

The code in this repository is licensed under the permissive ISC license (see [LICENSE](LICENSE)).
