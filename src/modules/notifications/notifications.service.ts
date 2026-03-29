import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

export interface NotifyParams {
  userId: number;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // Emits whenever a notification is created — consumed by gateways for real-time push
  readonly notification$ = new Subject<{ userId: number; notification: any }>();

  constructor(private readonly prisma: PrismaService) {}

  async notify(params: NotifyParams) {
    try {
      const record = await this.prisma.notification.create({
        data: {
          UserId: params.userId,
          Type: params.type,
          Title: params.title,
          Body: params.body,
          EntityType: params.entityType ?? null,
          EntityId: params.entityId ?? null,
        },
      });

      const notification = this.format(record);
      this.notification$.next({ userId: params.userId, notification });
      return notification;
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error instanceof Error ? error.message : error}`);
    }
  }

  async findAll(userId: number, unreadOnly = false) {
    const records = await this.prisma.notification.findMany({
      where: { UserId: userId, ...(unreadOnly ? { IsRead: false } : {}) },
      orderBy: { CreatedAt: 'desc' },
      take: 50,
    });
    return records.map(this.format);
  }

  async markRead(userId: number, ids?: number[]) {
    await this.prisma.notification.updateMany({
      where: {
        UserId: userId,
        ...(ids?.length ? { Id: { in: ids } } : {}),
        IsRead: false,
      },
      data: { IsRead: true },
    });
  }

  async unreadCount(userId: number) {
    return this.prisma.notification.count({ where: { UserId: userId, IsRead: false } });
  }

  private format(n: any) {
    return {
      id: n.Id,
      type: n.Type,
      title: n.Title,
      body: n.Body,
      entityType: n.EntityType || null,
      entityId: n.EntityId || null,
      isRead: n.IsRead,
      createdAt: n.CreatedAt.toISOString(),
    };
  }
}
