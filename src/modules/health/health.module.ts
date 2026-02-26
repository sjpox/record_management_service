import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HealthController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class HealthModule {}
