import { ApiService } from './app/api.service'
import { ApolloConfigFactoryService } from './graphql/apollo-config-factory.service'
import { EntryReferenceResolverGenerator } from './graphql/resolver-generators/entry-reference-resolver.generator'
import { InputTypeGeneratorService } from './graphql/input-type-generator.service'
import { QueriesMutationsGeneratorService } from './graphql/queries-mutations-generator.service'
import { SchemaAnalyzerService } from './graphql/schema-analyzer.service'
import { SchemaRootTypeGeneratorService } from './graphql/schema-root-type-generator.service'
import { UnionTypeResolverGenerator } from './graphql/resolver-generators/union-type-resolver-generator'
import { PersistenceService } from './persistence/persistence.service'
import { SchemaGeneratorService } from './graphql/schema-generator.service'
import { MutationCreateResolverGenerator } from './graphql/resolver-generators/mutation-create-resolver-generator'
import { MutationDeleteResolverGenerator } from './graphql/resolver-generators/mutation-delete-resolver-generator'
import { MutationUpdateResolverGenerator } from './graphql/resolver-generators/mutation-update-resolver-generator'
import { QueryAllResolverGenerator } from './graphql/resolver-generators/query-all-resolver-generator'
import { QueryByIdResolverGenerator } from './graphql/resolver-generators/query-by-id-resolver-generator'
import { QueryCountAllResolverGenerator } from './graphql/resolver-generators/query-count-all-resolver-generator'
import { QueryTypeByIdResolverGenerator } from './graphql/resolver-generators/query-type-by-id-resolver-generator'
import { SchemaValidator } from './graphql/schema-validator'
import { UnionValueResolverGenerator } from './graphql/resolver-generators/union-value-resolver-generator'
import { EntryReferenceUtil } from './graphql/schema-utils/entry-reference-util'

// we used to have a DI container here, however that doesn't work well with webpack & co, so doing it by hand for now

const entryReferenceUtil = new EntryReferenceUtil()
const schemaValidator = new SchemaValidator()
const persistenceService = new PersistenceService()
const schemaRootTypeGeneratorService = new SchemaRootTypeGeneratorService()

const inputTypeGeneratorService = new InputTypeGeneratorService(
  entryReferenceUtil,
)
const schemaAnalyzerService = new SchemaAnalyzerService(entryReferenceUtil)
const entryReferenceResolverGeneratorService =
  new EntryReferenceResolverGenerator(persistenceService)
const mutationCreateResolverGenerator = new MutationCreateResolverGenerator(
  persistenceService,
)
const mutationDeleteResolverGenerator = new MutationDeleteResolverGenerator(
  persistenceService,
)
const mutationUpdateResolverGenerator = new MutationUpdateResolverGenerator(
  persistenceService,
)
const queryAllResolverGenerator = new QueryAllResolverGenerator(
  persistenceService,
)
const queryByIdResolverGenerator = new QueryByIdResolverGenerator(
  persistenceService,
)
const queryCountAllResolverGenerator = new QueryCountAllResolverGenerator(
  persistenceService,
)
const queryTypeByIdResolverGenerator = new QueryTypeByIdResolverGenerator(
  persistenceService,
)
const unionTypeResolverGenerator = new UnionTypeResolverGenerator(
  persistenceService,
  entryReferenceUtil,
)
const unionValueResolverGenerator = new UnionValueResolverGenerator(
  entryReferenceUtil,
)

const queriesMutationsGeneratorService = new QueriesMutationsGeneratorService(
  queryAllResolverGenerator,
  queryByIdResolverGenerator,
  queryCountAllResolverGenerator,
  queryTypeByIdResolverGenerator,
  mutationCreateResolverGenerator,
  mutationUpdateResolverGenerator,
  mutationDeleteResolverGenerator,
)

const schemaGeneratorService = new SchemaGeneratorService(
  queriesMutationsGeneratorService,
  schemaAnalyzerService,
  inputTypeGeneratorService,
  schemaRootTypeGeneratorService,
  entryReferenceResolverGeneratorService,
  unionTypeResolverGenerator,
  unionValueResolverGenerator,
  schemaValidator,
)

const apolloConfigFactoryService = new ApolloConfigFactoryService(
  schemaGeneratorService,
)

export const apiService = new ApiService(
  apolloConfigFactoryService,
  schemaGeneratorService,
)
