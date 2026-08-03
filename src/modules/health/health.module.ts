import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceGateway } from './maintenance.gateway';

@Module({
  imports: [PrismaModule, AuthModule, PermissionsModule],
  controllers: [HealthController],
  providers: [MaintenanceService, MaintenanceGateway],
  exports: [MaintenanceService],
})
export class HealthModule {}
