import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PartiesController } from './parties.controller';
import { PartiesService } from './parties.service';

@Module({
  imports: [PrismaModule],
  controllers: [PartiesController],
  providers: [PartiesService],
  exports: [PartiesService],
})
export class PartiesModule {}
