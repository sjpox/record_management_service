import { Module } from '@nestjs/common';
import { DocTypesController } from './doc-types.controller';
import { DocTypesService } from './doc-types.service';

@Module({
  controllers: [DocTypesController],
  providers: [DocTypesService],
  exports: [DocTypesService],
})
export class DocTypesModule {}
