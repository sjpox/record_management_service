import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          EntityType: params.entityType,
          EntityId: params.entityId ?? null,
          Action: params.action,
          UserId: params.userId ?? null,
          Changes: params.error
            ? { ...params.changes, error: params.error }
            : params.changes ?? undefined,
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
