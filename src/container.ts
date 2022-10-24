import { asClass, createContainer, InjectionMode } from 'awilix'
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

const container = createContainer({ injectionMode: InjectionMode.CLASSIC })

container.register({
  api: asClass(ApiService),

  apolloConfigFactory: asClass(ApolloConfigFactoryService),
  entryReferenceResolverGenerator: asClass(
    EntryReferenceResolverGeneratorService,
  ),
  inputTypeGenerator: asClass(InputTypeGeneratorService),
  queriesMutationsGenerator: asClass(QueriesMutationsGeneratorService),
  schemaAnalyzer: asClass(SchemaAnalyzerService),
  schemaGenerator: asClass(SchemaGeneratorService),
  schemaRootTypeGenerator: asClass(SchemaRootTypeGeneratorService),
  unionTypeResolverGenerator: asClass(UnionTypeResolverGeneratorService),

  persistence: asClass(PersistenceService),
})

const api = container.resolve<ApiService>('api')

export const app = {
  api,
  container,
}
