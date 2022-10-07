import { Module } from '@nestjs/common'
import { GitAdapterFactoryService } from './git-adapter-factory.service'

@Module({
  imports: [],
  controllers: [],
  providers: [GitAdapterFactoryService],
  exports: [GitAdapterFactoryService],
})
export class GitModule {}
