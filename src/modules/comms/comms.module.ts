import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { CommsController } from './comms.controller';
import { CommsService } from './comms.service';

@Module({
  imports: [ScheduleModule, PrismaModule, AuthModule, AuditModule],
  controllers: [CommsController],
  providers: [CommsService],
  exports: [CommsService],
})
export class CommsModule {}
