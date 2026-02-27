import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Query audit logs with filters' })
  async findAll(@Query() query: QueryAuditLogDto) {
    const { page = 1, limit = 10, entityType, entityId, userId, action, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (entityType) where.EntityType = entityType;
    if (entityId) where.EntityId = entityId;
    if (userId) where.UserId = userId;
    if (action) where.Action = action;
    if (startDate || endDate) {
      where.Timestamp = {};
      if (startDate) where.Timestamp.gte = new Date(startDate);
      if (endDate) where.Timestamp.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { Timestamp: 'desc' },
        include: {
          User: {
            select: {
              Id: true,
              FirstName: true,
              LastName: true,
              EmployeeId: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
