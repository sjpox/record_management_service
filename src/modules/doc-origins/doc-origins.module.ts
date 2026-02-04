import { Module } from '@nestjs/common';
import { DocOriginsController } from './doc-origins.controller';
import { DocOriginsService } from './doc-origins.service';

@Module({
  controllers: [DocOriginsController],
  providers: [DocOriginsService],
  exports: [DocOriginsService],
})
export class DocOriginsModule {}
