import { Module } from '@nestjs/common'
import { ApiService } from './api.service'
import { GraphqlConfigModule } from '../graphql-config/graphql-config.module'
import { GitModule } from '../git/git.module'

@Module({
  imports: [GraphqlConfigModule, GitModule],
  controllers: [],
  providers: [ApiService],
  exports: [ApiService],
})
export class AppModule {}
