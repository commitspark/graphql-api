import { Module } from '@nestjs/common'
import { CommitApiService } from './commit-api.service'
import { GraphqlQueryFactoryService } from './graphql-query-factory.service'
import { QueryApiService } from './query-api.service'
import { ContentEntriesToActionsConverterService } from './content-entries-to-actions-converter.service'
import { HttpModule } from '@nestjs/axios'
import { ContextConfigModule } from '../../config/context-config.module'

@Module({
  imports: [HttpModule, ContextConfigModule],
  providers: [
    CommitApiService,
    GraphqlQueryFactoryService,
    QueryApiService,
    ContentEntriesToActionsConverterService,
  ],
  exports: [CommitApiService, QueryApiService],
})
export class GitModule {}
