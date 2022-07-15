import { Module } from '@nestjs/common'
import { ContextConfigService } from './context-config.service'
import { ConfigModule } from '@nestjs/config'

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [],
  providers: [ContextConfigService],
  exports: [ContextConfigService],
})
export class ContextConfigModule {}
