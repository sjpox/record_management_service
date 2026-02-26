import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class HealthModule {}
