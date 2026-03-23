import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { MaintenanceService } from './maintenance.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SetMaintenanceDto } from './dto/set-maintenance.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly maintenanceService: MaintenanceService,
    private readonly auditService: AuditService,
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
  async getStatus() {
    const isActive = await this.maintenanceService.isActive();
    return {
      maintenance: isActive,
      message: isActive ? await this.maintenanceService.getMessage() : '',
    };
  }

  @Post('maintenance')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toggle maintenance mode' })
  async setMaintenance(
    @Body() body: SetMaintenanceDto,
    @CurrentUser() user: { Id: number },
    @Req() req: Request,
  ) {
    const before = {
      maintenance: await this.maintenanceService.isActive(),
      message: await this.maintenanceService.getMessage(),
    };

    const result = await this.maintenanceService.setMaintenance(body.active, body.message);

    this.auditService.log({
      entityType: 'Maintenance',
      action: body.active ? 'MAINTENANCE_ON' : 'MAINTENANCE_OFF',
      userId: user.Id,
      changes: { before, after: result },
      ipAddress: req.ip,
    });

    return result;
  }
}
