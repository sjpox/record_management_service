import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';

export interface AuditLogParams {
  entityType: string;
  entityId?: number;
  action: string;
  userId?: number;
  changes?: { before?: any; after?: any };
  ipAddress?: string;
  error?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryAuditLogDto): Promise<PaginatedResult<any>> {
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

    const parsed = data.map((log) => ({
      ...log,
      Changes: log.Changes ? JSON.parse(log.Changes) : null,
    }));

    return {
      data: parsed,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          EntityType: params.entityType,
          EntityId: params.entityId ?? null,
          Action: params.action,
          UserId: params.userId ?? null,
          Changes: params.error
            ? JSON.stringify({ ...params.changes, error: params.error })
            : params.changes ? JSON.stringify(params.changes) : undefined,
          IpAddress: params.ipAddress ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
