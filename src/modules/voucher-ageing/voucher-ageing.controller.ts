import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VoucherAgeingService } from './voucher-ageing.service';
import { SetThresholdDto } from './dto/set-threshold.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

@ApiTags('Voucher Ageing')
@ApiBearerAuth()
@Controller('voucher-ageing')
@UseGuards(JwtAuthGuard)
export class VoucherAgeingController {
  constructor(
    private readonly service: VoucherAgeingService,
    private readonly auditService: AuditService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Get current voucher ageing threshold configuration' })
  async getConfig() {
    const config = await this.service.getConfig();
    return {
      thresholdDays: config.ThresholdDays,
      updatedAt: config.UpdatedAt,
    };
  }

  @Put('config')
  @ApiOperation({ summary: 'Update voucher ageing threshold (admin only)' })
  async setThreshold(
    @Body() dto: SetThresholdDto,
    @CurrentUser() user: { Id: number },
  ) {
    const before = await this.service.getConfig();
    const result = await this.service.setThreshold(dto, user.Id);

    this.auditService.log({
      entityType: 'VoucherAgeingConfig',
      entityId: 1,
      action: 'UPDATE',
      userId: user.Id,
      changes: {
        before: { thresholdDays: before.ThresholdDays },
        after: { thresholdDays: result.thresholdDays },
      },
    });

    return result;
  }
}
