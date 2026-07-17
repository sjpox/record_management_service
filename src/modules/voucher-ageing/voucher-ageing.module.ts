import { Module } from '@nestjs/common';
import { VoucherAgeingController } from './voucher-ageing.controller';
import { VoucherAgeingService } from './voucher-ageing.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [VoucherAgeingController],
  providers: [VoucherAgeingService],
  exports: [VoucherAgeingService],
})
export class VoucherAgeingModule {}
