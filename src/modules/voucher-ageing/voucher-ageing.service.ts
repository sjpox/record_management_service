import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SetThresholdDto } from './dto/set-threshold.dto';

const DEFAULT_THRESHOLD_DAYS = 30;

@Injectable()
export class VoucherAgeingService implements OnModuleInit {
  private readonly logger = new Logger(VoucherAgeingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureConfig();
  }

  async getConfig() {
    return (
      (await this.prisma.voucherAgeingConfig.findUnique({ where: { Id: 1 } })) ??
      (await this.ensureConfig())
    );
  }

  async setThreshold(dto: SetThresholdDto, userId: number) {
    const config = await this.prisma.voucherAgeingConfig.upsert({
      where: { Id: 1 },
      update: {
        ThresholdDays: dto.ThresholdDays,
        UpdatedById: userId,
      },
      create: {
        Id: 1,
        ThresholdDays: dto.ThresholdDays,
        UpdatedById: userId,
      },
    });

    return {
      thresholdDays: config.ThresholdDays,
      updatedAt: config.UpdatedAt,
    };
  }

  private async ensureConfig() {
    try {
      return await this.prisma.voucherAgeingConfig.upsert({
        where: { Id: 1 },
        update: {},
        create: { Id: 1, ThresholdDays: DEFAULT_THRESHOLD_DAYS },
      });
    } catch (error) {
      this.logger.warn(
        'Could not initialize voucher ageing config — table may not exist yet. Run prisma migrate.',
        error instanceof Error ? error.message : error,
      );
      return {
        Id: 1,
        ThresholdDays: DEFAULT_THRESHOLD_DAYS,
        UpdatedAt: new Date(),
        UpdatedById: null,
      };
    }
  }
}
