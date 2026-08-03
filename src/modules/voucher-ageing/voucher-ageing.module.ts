import { Module } from '@nestjs/common';
import { VoucherAgeingController } from './voucher-ageing.controller';
import { VoucherAgeingService } from './voucher-ageing.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, PermissionsModule],
  controllers: [VoucherAgeingController],
  providers: [VoucherAgeingService],
  exports: [VoucherAgeingService],
})
export class VoucherAgeingModule {}
