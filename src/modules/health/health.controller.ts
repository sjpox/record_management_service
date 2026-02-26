import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly maintenanceService: MaintenanceService,
  ) {}

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

  @Get('status')
  @ApiOperation({ summary: 'Check maintenance mode status' })
  getStatus() {
    return {
      maintenance: this.maintenanceService.isActive(),
      message: this.maintenanceService.isActive()
        ? this.maintenanceService.getMessage()
        : '',
    };
  }
}
