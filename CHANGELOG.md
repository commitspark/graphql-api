# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
