import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'unknown',
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      status.database = 'connected';
    } catch {
      status.database = 'disconnected';
      status.status = 'degraded';
    }

    return status;
  }
}
