# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Restrict Apollo Server to version 5.0 due to build failures introduced by 5.1 when using this library in Next.js
  (see [apollographql/apollo-server #8159](https://github.com/apollographql/apollo-server/issues/8159))

## [1.0.0-beta.2] - 2025-11-07

### Changed

- Expose errors explicitly and with metadata
- Rename generated `all...` queries to `every...` to avoid having to pluralize entry type names

## [1.0.0-beta.1] - 2025-11-05

### Changed

- Refactor implementation to drop dependency injection pattern
- Rename main entry point `getApiService()` to `createClient()` to better match purpose
- Move `gitAdapter` argument into `createClient()`
- Remove query `_all...Meta` in favor of future pagination support

## [0.90.0] - 2025-09-07

### Changed

- Upgrade to supported Apollo Server 5
- Upgrade dependencies

## [0.81.2] - 2025-04-16

### Changed

- Improve library exports

## [0.81.1] - 2025-04-16

### Fixed

- Fix incorrect types export

### Changed

- Improve library exports

## [0.81.0] - 2025-04-13

### Changed

- Refactor library packaging to support ESM and CJS
- Clean up dependencies and relax version constraints

## [0.80.0] - 2025-03-19

### Changed

- Rewrite README for clarity
- Remove superfluous `DeletionResult` type and replace with `ID` scalar in order to simplify API
- Rename mutation `message` argument to `commitMessage` for more intuitive API use
- Make mutation `data` argument non-null for more intuitive API use

## [0.12.0] - 2025-03-17

### Changed

- Stop transforming field name case for concrete union types so that relationship to concrete type is more clear in
  serialized data
- Upgrade dependencies

## [0.11.1] - 2024-12-29

### Added

- Export API response types

### Changed

- Upgrade dependencies

## [0.11.0] - 2024-08-17

### Changed

- Upgrade to `@commitspark/git-adapter` 0.13.0

## [0.10.0] - 2024-06-15

### Added

- Add referential integrity by tracking and validating references between entries
- Add support of partial updates

### Fixed

- [#18](https://github.com/commitspark/graphql-api/issues/18), [#25](https://github.com/commitspark/graphql-api/issues/25)
  Fix handling of entries that only have an `id` field

### Changed

- Return default data where possible when entry data is incomplete
- Improve content retrieval performance

## [0.9.4] - 2023-11-14

### Fixed

- Fix invalid schema built when running under Next.js 14

## [0.9.3] - 2023-09-06

### Fixed

- Fix failure to resolve array of non-@Entry union types that is null

### Changed

- Update dependencies

## [0.9.2] - 2023-07-22

### Fixed

- Fix documentation to match implementation
- Fix missing numeric character permission in entry ID validation regex

## [0.9.1] - 2023-07-09

### Fixed

- Fix broken NPM package build

## [0.9.0] - 2023-07-09

### Changed

- Improve schema formatting
- Expose entry ID as argument of "create" mutation instead of automatic ID generation
- Check ID of entry before executing an update, delete mutation
- Update dependencies

### Fixed

- [#32](https://github.com/commitspark/graphql-api/issues/32) Fix memory leak triggered by API calls

## [0.8.0] - 2023-06-17

### Fixed

- [#26](https://github.com/commitspark/graphql-api/issues/26) Querying optional reference field with null value causes
  exception

## [0.7.0] - 2023-05-12

### Changed

- Rename organization
- Remove deprecated code

## [0.6.1] - 2023-05-07

### Changed

- Improve documentation

## [0.6.0] - 2023-04-27

### Changed

- Enable strict TypeScript for improved type safety
- Update packages to address NPM security audit

### Fixed

- [#23](https://github.com/commitspark/graphql-api/issues/23) Data of unions with non-Entry members is
  not discernible after serialization

## [0.5.4] - 2023-03-15

### Changed

- Remove dependency injection package to support bundling with webpack & co.
- Upgrade to Apollo Server 4.5

## [0.5.3] - 2023-03-12

### Changed

- Improve GraphQL endpoint type definition

## [0.5.2] - 2022-11-14

### Changed

- Update dependencies
- Upgrade to Apollo Server 4

## [0.5.1] - 2022-11-04

### Changed

- Clean up unused dependencies
- Extensive update of README

### Fixed

- Fix omission of providing preceding commit hash when requesting a new commit from Git adapter

## [0.5.0] - 2022-11-01

### Changed

- Move NPM package to organization namespace
- Update to organization-based `git-adapter`

## [0.4.1] - 2022-10-25

### Changed

- Update to Git Adapter interface 0.4.0

## [0.4.0] - 2022-10-25

### Changed

- Move responsibility for Git adapter lifecycle out of library
- Make type query use commit hash for better performance

## [0.3.0] - 2022-10-24

### Changed

- Drop NestJS in favor of awilix due to https://github.com/nestjs/nest/issues/9622

## [0.2.1] - 2022-10-11

### Fixed

- Export signature of `ApiService`

### Changed

- Move example application into [separate repository](https://github.com/commitspark/example-code-serverless)

## [0.2.0] - 2022-10-07

### Changed

- Move GitLab (SaaS) implementation into [separate repository](https://github.com/commitspark/git-adapter-gitlab)
- Refactor code to be used as library
- Move application-specific code to example directory
- Upgrade to NestJS 9
- Refactor code to be truly stateless

## [0.1.0] - 2022-07-15

### Added

- Initial release
