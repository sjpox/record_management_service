import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

const announcementInclude = {
  CreatedBy: { select: { Id: true, FirstName: true, LastName: true } },
};

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private format(a: any) {
    return {
      id: a.Id,
      title: a.Title,
      content: a.Content,
      category: a.Category,
      priority: a.Priority,
      status: a.Status,
      isDismissible: a.IsDismissible,
      startDate: a.StartDate ? a.StartDate.toISOString() : null,
      endDate: a.EndDate ? a.EndDate.toISOString() : null,
      createdBy: a.CreatedBy
        ? { id: a.CreatedBy.Id, firstName: a.CreatedBy.FirstName, lastName: a.CreatedBy.LastName }
        : null,
      createdAt: a.CreatedAt.toISOString(),
      updatedAt: a.UpdatedAt.toISOString(),
    };
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
    priority?: string;
    activeOnly?: boolean;
  }) {
    const { page = 1, limit = 10, search, category, status, priority, activeOnly = false } = params;
    const where: any = {};

    if (search) {
      where.OR = [
        { Title: { contains: search } },
        { Content: { contains: search } },
      ];
    }
    if (category) where.Category = category;
    if (status) where.Status = status;
    if (priority) where.Priority = priority;

    if (activeOnly) {
      where.Status = 'published';
      const now = new Date();
      where.AND = [
        { OR: [{ StartDate: null }, { StartDate: { lte: now } }] },
        { OR: [{ EndDate: null }, { EndDate: { gte: now } }] },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        include: announcementInclude,
        orderBy: { CreatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      data: data.map((a) => this.format(a)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const a = await this.prisma.announcement.findUnique({
      where: { Id: id },
      include: announcementInclude,
    });
    if (!a) throw new NotFoundException('Announcement not found');
    return this.format(a);
  }

  async create(dto: CreateAnnouncementDto, userId: number) {
    const a = await this.prisma.announcement.create({
      data: {
        Title: dto.title.trim(),
        Content: dto.content.trim(),
        Category: dto.category || 'general',
        Priority: dto.priority || 'normal',
        Status: dto.status || 'draft',
        IsDismissible: dto.isDismissible !== undefined ? dto.isDismissible : true,
        StartDate: dto.startDate ? new Date(dto.startDate) : null,
        EndDate: dto.endDate ? new Date(dto.endDate) : null,
        CreatedById: userId,
      },
      include: announcementInclude,
    });

    const result = this.format(a);
    await this.audit.log({ entityType: 'Announcement', entityId: a.Id, action: 'create', userId, changes: { after: result } });

    // Notify all active users if published immediately
    if (a.Status === 'published') {
      await this.notifyAllUsers(a.Id, a.Title, userId);
    }

    return result;
  }

  async update(id: number, dto: UpdateAnnouncementDto, userId: number) {
    const existing = await this.prisma.announcement.findUnique({ where: { Id: id } });
    if (!existing) throw new NotFoundException('Announcement not found');

    const wasPublished = existing.Status === 'published';

    const a = await this.prisma.announcement.update({
      where: { Id: id },
      data: {
        ...(dto.title !== undefined && { Title: dto.title.trim() }),
        ...(dto.content !== undefined && { Content: dto.content.trim() }),
        ...(dto.category !== undefined && { Category: dto.category }),
        ...(dto.priority !== undefined && { Priority: dto.priority }),
        ...(dto.status !== undefined && { Status: dto.status }),
        ...(dto.isDismissible !== undefined && { IsDismissible: dto.isDismissible }),
        ...(dto.startDate !== undefined && { StartDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { EndDate: dto.endDate ? new Date(dto.endDate) : null }),
      },
      include: announcementInclude,
    });

    const result = this.format(a);
    await this.audit.log({ entityType: 'Announcement', entityId: id, action: 'update', userId, changes: { after: result } });

    // Notify when status changes to published
    if (!wasPublished && a.Status === 'published') {
      await this.notifyAllUsers(a.Id, a.Title, userId);
    }

    return result;
  }

  async remove(id: number, userId: number) {
    const existing = await this.prisma.announcement.findUnique({ where: { Id: id } });
    if (!existing) throw new NotFoundException('Announcement not found');

    await this.prisma.announcement.delete({ where: { Id: id } });
    await this.audit.log({ entityType: 'Announcement', entityId: id, action: 'delete', userId });
  }

  private async notifyAllUsers(announcementId: number, title: string, excludeUserId: number) {
    const users = await this.prisma.users.findMany({
      where: { IsActive: true, Id: { not: excludeUserId } },
      select: { Id: true },
    });

    await Promise.all(
      users.map((u) =>
        this.notifications.notify({
          userId: u.Id,
          type: 'announcement',
          title: 'New Announcement',
          body: title,
          entityType: 'announcement',
          entityId: announcementId,
        }),
      ),
    );
  }
}
