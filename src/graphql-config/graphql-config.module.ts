import { Module } from '@nestjs/common'
import { ApolloConfigFactoryService } from './apollo-config-factory.service'
import { SchemaAnalyzerService } from './schema-analyzer.service'
import { InputTypeGeneratorService } from './input-type-generator.service'
import { QueriesMutationsGeneratorService } from './queries-mutations-generator.service'
import { SchemaRootTypeGeneratorService } from './schema-root-type-generator.service'
import { PersistenceModule } from '../persistence/persistence.module'
import { GitModule } from '../git/git.module'
import { SchemaGeneratorService } from './schema-generator.service'
import { EntryReferenceResolverGeneratorService } from './entry-reference-resolver-generator.service'
import { UnionTypeResolverGeneratorService } from './union-type-resolver-generator-service'

@Module({
  imports: [PersistenceModule, GitModule],
  providers: [
    ApolloConfigFactoryService,
    EntryReferenceResolverGeneratorService,
    InputTypeGeneratorService,
    QueriesMutationsGeneratorService,
    SchemaAnalyzerService,
    SchemaGeneratorService,
    SchemaRootTypeGeneratorService,
    UnionTypeResolverGeneratorService,
  ],
  exports: [ApolloConfigFactoryService, SchemaGeneratorService],
})
export class GraphqlConfigModule {}
