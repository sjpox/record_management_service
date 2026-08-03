import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PermissionGuard } from './permission.guard';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [PrismaModule],
  providers: [PermissionsService, PermissionGuard],
  controllers: [PermissionsController],
  exports: [PermissionsService, PermissionGuard],
})
export class PermissionsModule {}
