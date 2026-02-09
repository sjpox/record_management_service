import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Check application and database health' })
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
