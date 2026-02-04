import { Module } from '@nestjs/common';
import { ResponPersonsController } from './respon-persons.controller';
import { ResponPersonsService } from './respon-persons.service';

@Module({
  controllers: [ResponPersonsController],
  providers: [ResponPersonsService],
  exports: [ResponPersonsService],
})
export class ResponPersonsModule {}
