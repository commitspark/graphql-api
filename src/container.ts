import { ApiService } from './app/api.service'
import { ApolloConfigFactoryService } from './graphql-config/apollo-config-factory.service'
import { EntryReferenceResolverGeneratorService } from './graphql-config/entry-reference-resolver-generator.service'
import { InputTypeGeneratorService } from './graphql-config/input-type-generator.service'
import { QueriesMutationsGeneratorService } from './graphql-config/queries-mutations-generator.service'
import { SchemaAnalyzerService } from './graphql-config/schema-analyzer.service'
import { SchemaRootTypeGeneratorService } from './graphql-config/schema-root-type-generator.service'
import { UnionTypeResolverGeneratorService } from './graphql-config/union-type-resolver-generator-service'
import { PersistenceService } from './persistence/persistence.service'
import { SchemaGeneratorService } from './graphql-config/schema-generator.service'

// we used to have a DI container here, however that doesn't work well with webpack & co, so doing it by hand for now

const persistenceService = new PersistenceService()
const schemaRootTypeGeneratorService = new SchemaRootTypeGeneratorService()
const schemaAnalyzerService = new SchemaAnalyzerService()
const inputTypeGeneratorService = new InputTypeGeneratorService()

const unionTypeResolverGeneratorService = new UnionTypeResolverGeneratorService(
  persistenceService,
)
const queriesMutationsGeneratorService = new QueriesMutationsGeneratorService(
  persistenceService,
)
const entryReferenceResolverGeneratorService =
  new EntryReferenceResolverGeneratorService(persistenceService)

const schemaGeneratorService = new SchemaGeneratorService(
  queriesMutationsGeneratorService,
  schemaAnalyzerService,
  inputTypeGeneratorService,
  schemaRootTypeGeneratorService,
  entryReferenceResolverGeneratorService,
  unionTypeResolverGeneratorService,
)

const apolloConfigFactoryService = new ApolloConfigFactoryService(
  schemaGeneratorService,
)

export const apiService = new ApiService(
  apolloConfigFactoryService,
  schemaGeneratorService,
)
