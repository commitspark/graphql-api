import { Module } from '@nestjs/common'
import { PersistenceService } from './persistence.service'
import { GitModule } from '../git/gitlab/git.module'

@Module({
  imports: [GitModule],
  providers: [PersistenceService],
  exports: [PersistenceService],
})
export class PersistenceModule {}
