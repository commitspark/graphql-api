import { ApiService } from './app/api.service'
import { ApolloConfigFactoryService } from './graphql/apollo-config-factory.service'
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
import { UnionValueResolver } from './graphql/field-resolver/union-value-resolver'
import { EntryReferenceUtil } from './graphql/schema-utils/entry-reference-util'
import { ObjectTypeFieldDefaultValueResolverGenerator } from './graphql/resolver-generators/object-type-field-default-value-resolver-generator'
import { FieldDefaultValueResolver } from './graphql/field-resolver/field-default-value-resolver'
import { EntryReferenceResolver } from './graphql/field-resolver/entry-reference-resolver'
import { UnionTypeUtil } from './graphql/schema-utils/union-type-util'
import { EntryTypeUtil } from './graphql/schema-utils/entry-type-util'

// we used to have a DI container here, however that doesn't work well with webpack & co, so doing it by hand for now

const schemaValidator = new SchemaValidator()
const persistenceService = new PersistenceService()
const entryTypeUtil = new EntryTypeUtil()
const unionTypeUtil = new UnionTypeUtil()
const entryReferenceUtil = new EntryReferenceUtil(
  persistenceService,
  entryTypeUtil,
  unionTypeUtil,
)
const schemaRootTypeGeneratorService = new SchemaRootTypeGeneratorService()

const inputTypeGeneratorService = new InputTypeGeneratorService(entryTypeUtil)
const schemaAnalyzerService = new SchemaAnalyzerService()
const mutationCreateResolverGenerator = new MutationCreateResolverGenerator(
  persistenceService,
  entryReferenceUtil,
)
const mutationDeleteResolverGenerator = new MutationDeleteResolverGenerator(
  persistenceService,
  entryReferenceUtil,
)
const mutationUpdateResolverGenerator = new MutationUpdateResolverGenerator(
  persistenceService,
  entryReferenceUtil,
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
  entryTypeUtil,
)
const unionValueResolver = new UnionValueResolver(unionTypeUtil)
const entryReferenceResolver = new EntryReferenceResolver(persistenceService)
const fieldDefaultValueResolver = new FieldDefaultValueResolver(
  entryTypeUtil,
  unionValueResolver,
  entryReferenceResolver,
)
const objectTypeFieldDefaultValueResolverGenerator =
  new ObjectTypeFieldDefaultValueResolverGenerator(fieldDefaultValueResolver)

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
  unionTypeResolverGenerator,
  objectTypeFieldDefaultValueResolverGenerator,
  schemaValidator,
)

const apolloConfigFactoryService = new ApolloConfigFactoryService(
  schemaGeneratorService,
)

export const apiService = new ApiService(
  apolloConfigFactoryService,
  schemaGeneratorService,
)
