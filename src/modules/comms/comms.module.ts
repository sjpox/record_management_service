import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { CommsController } from './comms.controller';
import { CommsService } from './comms.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [CommsController],
  providers: [CommsService],
  exports: [CommsService],
})
export class CommsModule {}
