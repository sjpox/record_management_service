import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { FtpService } from '../../common/services/ftp.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommDto } from './dto/create-comm.dto';
import { UpdateCommDto } from './dto/update-comm.dto';
import sharp from 'sharp';

const userSelect = { Id: true, FirstName: true, LastName: true };

const commInclude = {
  CreatedBy: { select: userSelect },
  ArchivedBy: { select: userSelect },
  DocumentType: { select: { Id: true, Type: true } },
  ShelfItem: {
    include: {
      Shelf: {
        include: {
          Cabinet: { select: { Id: true, Name: true } },
        },
      },
    },
  },
  Images: true,
  Actions: {
    include: {
      CompletedBy: { select: userSelect },
      Assignees: {
        include: { User: { select: userSelect } },
      },
      _count: { select: { Replies: true } },
    },
    orderBy: { DueDate: 'asc' as const },
  },
};

@Injectable()
export class CommsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ftpService: FtpService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private formatComm(comm: any) {
    return {
      id: comm.Id,
      type: comm.Type,
      referenceNumber: comm.ReferenceNumber,
      subject: comm.Subject,
      description: comm.Description || null,
      sender: comm.Sender,
      recipient: comm.Recipient,
      dateReceived: comm.DateReceived.toISOString(),
      dateSent: comm.DateSent?.toISOString() || null,
      status: comm.Status,
      priority: comm.Priority,
      actions: (comm.Actions || []).map((a: any) => ({
        id: a.Id,
        communicationId: a.CommunicationId,
        actionRequired: a.ActionRequired,
        dueDate: a.DueDate?.toISOString() || null,
        status: a.Status,
        assignees: (a.Assignees || []).map((assignee: any) => ({
          id: assignee.Id,
          userId: assignee.UserId || null,
          name: assignee.User
            ? `${assignee.User.FirstName} ${assignee.User.LastName}`
            : assignee.Name,
        })),
        createdAt: a.CreatedAt.toISOString(),
        replyCount: a._count?.Replies || 0,
        completedAt: a.CompletedAt?.toISOString() || null,
        completedBy: a.CompletedBy
          ? { id: a.CompletedBy.Id, firstName: a.CompletedBy.FirstName, lastName: a.CompletedBy.LastName }
          : null,
        notes: a.Notes || null,
      })),
      images: (comm.Images || []).map((img: any) => ({
        id: img.Id,
        imageFile: img.ImageFile,
        imageFileType: img.ImageFileType,
        imageFileSize: img.ImageFileSize,
      })),
      createdBy: comm.CreatedBy
        ? { id: comm.CreatedBy.Id, firstName: comm.CreatedBy.FirstName, lastName: comm.CreatedBy.LastName }
        : null,
      createdAt: comm.CreatedAt.toISOString(),
      updatedAt: comm.UpdatedAt.toISOString(),
      isArchived: comm.IsArchived,
      archivedAt: comm.ArchivedAt?.toISOString() || null,
      archivedBy: comm.ArchivedBy
        ? { id: comm.ArchivedBy.Id, firstName: comm.ArchivedBy.FirstName, lastName: comm.ArchivedBy.LastName }
        : null,
      documentType: comm.DocumentType
        ? { id: comm.DocumentType.Id, type: comm.DocumentType.Type }
        : null,
      shelfItem: comm.ShelfItem
        ? {
            id: comm.ShelfItem.Id,
            label: comm.ShelfItem.Label,
            shelf: {
              id: comm.ShelfItem.Shelf.Id,
              name: comm.ShelfItem.Shelf.Name,
              cabinet: comm.ShelfItem.Shelf.Cabinet,
            },
          }
        : null,
    };
  }

  private async buildVisibilityFilter(userId: number, userRole?: string): Promise<any | null> {
    if (userRole === 'admin') return null; // no filter — admin sees all

    const user = await this.prisma.users.findUnique({
      where: { Id: userId },
      select: { FirstName: true, LastName: true },
    });
    const fullName = user ? `${user.FirstName} ${user.LastName}` : '';

    return {
      OR: [
        { CreatedById: userId },
        ...(fullName ? [{ Recipient: { contains: fullName } }] : []),
        { Actions: { some: { Assignees: { some: { UserId: userId } } } } },
      ],
    };
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    priority?: string;
    search?: string;
    isArchived?: boolean;
    sortBy?: string;
    sortOrder?: string;
    userId?: number;
    userRole?: string;
  }) {
    const { page = 1, limit = 10, type, status, priority, search, isArchived = false, sortBy, sortOrder, userId, userRole } = params;
    const where: any = { IsArchived: isArchived };

    // Visibility: non-admins only see comms they created, are a recipient of, or are assigned to
    if (userId) {
      const visFilter = await this.buildVisibilityFilter(userId, userRole);
      if (visFilter) {
        where.AND = [visFilter];
      }
    }

    if (type && type !== 'all') where.Type = type;
    if (status && status !== 'all') where.Status = status;
    if (priority && priority !== 'all') where.Priority = priority;
    if (search) {
      const searchFilter = {
        OR: [
          { Subject: { contains: search } },
          { ReferenceNumber: { contains: search } },
          { Sender: { contains: search } },
          { Recipient: { contains: search } },
        ],
      };
      where.AND = [...(where.AND || []), searchFilter];
    }

    const sortFieldMap: Record<string, string> = {
      archivedAt: 'ArchivedAt',
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
      dateReceived: 'DateReceived',
      dateSent: 'DateSent',
    };
    const orderByField = (sortBy && sortFieldMap[sortBy]) || 'CreatedAt';
    const orderByDir = sortOrder === 'asc' ? 'asc' : 'desc';

    const [data, total] = await Promise.all([
      this.prisma.communication.findMany({
        where,
        include: commInclude,
        orderBy: { [orderByField]: orderByDir },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.communication.count({ where }),
    ]);

    return {
      data: data.map((c) => this.formatComm(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    return this.getDetails(id);
  }

  async create(dto: CreateCommDto, userId: number) {
    if (dto.type === 'incoming' && !dto.dateReceived) {
      throw new BadRequestException('dateReceived is required for incoming communications');
    }
    if (dto.type === 'outgoing' && !dto.dateSent) {
      throw new BadRequestException('dateSent is required for outgoing communications');
    }

    const prefix = dto.type === 'incoming' ? 'IN' : 'OUT';
    const year = new Date().getFullYear();
    const count = await this.prisma.communication.count({
      where: { Type: dto.type },
    });
    const seq = String(count + 1).padStart(4, '0');
    const referenceNumber = `${prefix}-${year}-${seq}`;

    const comm = await this.prisma.communication.create({
      data: {
        Type: dto.type,
        ReferenceNumber: referenceNumber,
        Subject: dto.subject,
        Description: dto.description || null,
        Sender: dto.sender,
        Recipient: dto.recipient,
        DateReceived: dto.dateReceived ? new Date(dto.dateReceived) : new Date(),
        DateSent: dto.dateSent ? new Date(dto.dateSent) : null,
        Priority: dto.priority || 'normal',
        DocumentTypeId: dto.documentTypeId || null,
        CreatedById: userId,
        Actions: dto.actions?.length
          ? {
              create: dto.actions.map((a) => ({
                ActionRequired: a.actionRequired,
                DueDate: a.dueDate ? new Date(a.dueDate) : null,
                Assignees: a.assignees?.length
                  ? {
                      create: a.assignees.map((assignee) => ({
                        UserId: assignee.userId || null,
                        Name: assignee.name || null,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: commInclude,
    });

    const result = this.formatComm(comm);
    await this.audit.log({ entityType: 'Communication', entityId: comm.Id, action: 'create', userId, changes: { after: result } });

    // Notify registered assignees
    for (const action of comm.Actions) {
      await this.notifyAssignees(action, comm.ReferenceNumber, comm.Subject, comm.Id);
    }

    // Notify recipient users
    if (dto.recipientUserIds?.length) {
      await this.notifyRecipients(dto.recipientUserIds, comm.ReferenceNumber, comm.Subject, userId, comm.Id);
    }

    return result;
  }

  async update(id: number, dto: UpdateCommDto, userId?: number) {
    const existing = await this.prisma.communication.findUnique({ where: { Id: id } });
    if (!existing) throw new NotFoundException('Communication not found');

    const updateData: any = {};
    if (dto.type) updateData.Type = dto.type;
    if (dto.subject) updateData.Subject = dto.subject;
    if (dto.description !== undefined) updateData.Description = dto.description || null;
    if (dto.sender) updateData.Sender = dto.sender;
    if (dto.recipient) updateData.Recipient = dto.recipient;
    if (dto.dateReceived) updateData.DateReceived = new Date(dto.dateReceived);
    if (dto.dateSent !== undefined) updateData.DateSent = dto.dateSent ? new Date(dto.dateSent) : null;
    if (dto.priority) updateData.Priority = dto.priority;
    if (dto.status) updateData.Status = dto.status;
    if (dto.documentTypeId !== undefined) updateData.DocumentTypeId = dto.documentTypeId || null;

    if (dto.actions) {
      const incomingIds = dto.actions.filter((a) => a.id).map((a) => a.id!);

      // Delete actions not in the incoming list
      await this.prisma.commAction.deleteMany({
        where: { CommunicationId: id, Id: { notIn: incomingIds } },
      });

      for (const a of dto.actions) {
        if (a.id) {
          // Update existing action
          await this.prisma.commAction.update({
            where: { Id: a.id },
            data: {
              ActionRequired: a.actionRequired,
              ...(a.dueDate && { DueDate: new Date(a.dueDate) }),
            },
          });

          // Sync assignees for existing action
          if (a.assignees !== undefined) {
            const incomingAssigneeIds = a.assignees.filter((as) => as.id).map((as) => as.id!);
            await this.prisma.commActionAssignee.deleteMany({
              where: { ActionId: a.id, Id: { notIn: incomingAssigneeIds } },
            });
            for (const assignee of a.assignees) {
              if (assignee.id) {
                await this.prisma.commActionAssignee.update({
                  where: { Id: assignee.id },
                  data: { UserId: assignee.userId || null, Name: assignee.name || null },
                });
              } else {
                await this.prisma.commActionAssignee.create({
                  data: { ActionId: a.id, UserId: assignee.userId || null, Name: assignee.name || null },
                });
                if (assignee.userId) {
                  const comm = await this.prisma.communication.findUnique({ where: { Id: id }, select: { ReferenceNumber: true, Subject: true } });
                  const action = await this.prisma.commAction.findUnique({ where: { Id: a.id }, select: { ActionRequired: true } });
                  await this.notifications.notify({
                    userId: assignee.userId,
                    type: 'comm_action_assigned',
                    title: 'You have been assigned an action item',
                    body: `[${comm!.ReferenceNumber}] ${comm!.Subject}: ${action!.ActionRequired}`,
                    entityType: 'CommAction',
                    entityId: a.id,
                  });
                }
              }
            }
          }
        } else {
          // Create new action with assignees
          const newAction = await this.prisma.commAction.create({
            data: {
              CommunicationId: id,
              ActionRequired: a.actionRequired,
              DueDate: a.dueDate ? new Date(a.dueDate) : null,
              Assignees: a.assignees?.length
                ? {
                    create: a.assignees.map((assignee) => ({
                      UserId: assignee.userId || null,
                      Name: assignee.name || null,
                    })),
                  }
                : undefined,
            },
            include: { Assignees: true },
          });
          const comm = await this.prisma.communication.findUnique({ where: { Id: id }, select: { ReferenceNumber: true, Subject: true } });
          await this.notifyAssignees(newAction, comm!.ReferenceNumber, comm!.Subject, id);
        }
      }
    }

    const comm = await this.prisma.communication.update({
      where: { Id: id },
      data: updateData,
      include: commInclude,
    });

    const result = this.formatComm(comm);
    await this.audit.log({ entityType: 'Communication', entityId: id, action: 'update', userId, changes: { after: result } });

    // Notify all recipients and assignees about the update
    if (userId) {
      const notifyUserIds = new Set<number>();

      // Add recipient user IDs
      if (dto.recipientUserIds?.length) {
        for (const uid of dto.recipientUserIds) notifyUserIds.add(uid);
      }

      // Add all current assignee user IDs
      for (const action of comm.Actions) {
        for (const assignee of action.Assignees) {
          if (assignee.UserId) notifyUserIds.add(assignee.UserId);
        }
      }

      // Remove the user who made the update
      notifyUserIds.delete(userId);

      for (const uid of notifyUserIds) {
        await this.notifications.notify({
          userId: uid,
          type: 'comm_updated',
          title: 'A communication has been updated',
          body: `[${comm.ReferenceNumber}] ${comm.Subject}`,
          entityType: 'Communication',
          entityId: comm.Id,
        });
      }
    }

    return result;
  }

  async remove(id: number, userId?: number) {
    const existing = await this.prisma.communication.findUnique({ where: { Id: id } });
    if (!existing) throw new NotFoundException('Communication not found');
    await this.prisma.communication.delete({ where: { Id: id } });
    await this.audit.log({ entityType: 'Communication', entityId: id, action: 'delete', userId });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async markOverdueActions() {
    const now = new Date();

    // Mark all pending actions past their due date as overdue
    await this.prisma.commAction.updateMany({
      where: {
        Status: 'pending',
        DueDate: { lt: now },
      },
      data: { Status: 'overdue' },
    });

    // Recalculate comm status for every communication that currently has an overdue action
    const affectedComms = await this.prisma.commAction.findMany({
      where: { Status: 'overdue' },
      select: { CommunicationId: true },
      distinct: ['CommunicationId'],
    });

    for (const { CommunicationId } of affectedComms) {
      await this.recalcCommStatus(CommunicationId);
    }
  }

  async toggleActionStatus(actionId: number, userId: number) {
    const action = await this.prisma.commAction.findUnique({ where: { Id: actionId } });
    if (!action) throw new NotFoundException('Action not found');

    // Cycle: pending → in-progress → completed → pending
    let nextStatus: string;
    if (action.Status === 'pending' || action.Status === 'overdue') {
      nextStatus = 'in-progress';
    } else if (action.Status === 'in-progress') {
      nextStatus = 'completed';
    } else {
      nextStatus = 'pending';
    }

    const isCompleting = nextStatus === 'completed';
    await this.prisma.commAction.update({
      where: { Id: actionId },
      data: {
        Status: nextStatus,
        CompletedAt: isCompleting ? new Date() : null,
        CompletedById: isCompleting ? userId : null,
      },
    });

    await this.recalcCommStatus(action.CommunicationId, actionId, isCompleting);

    const auditAction = isCompleting ? 'complete' : nextStatus === 'in-progress' ? 'start' : 'reopen';
    await this.audit.log({ entityType: 'CommAction', entityId: actionId, action: auditAction, userId });
    return this.getDetails(action.CommunicationId);
  }

  private async notifyRecipients(userIds: number[], referenceNumber: string, subject: string, senderUserId: number, commId: number) {
    for (const uid of userIds) {
      if (uid === senderUserId) continue; // Don't notify the sender
      await this.notifications.notify({
        userId: uid,
        type: 'comm_recipient',
        title: 'You are a recipient of a communication',
        body: `[${referenceNumber}] ${subject}`,
        entityType: 'Communication',
        entityId: commId,
      });
    }
  }

  private async notifyAssignees(action: any, referenceNumber: string, subject: string, commId: number) {
    for (const assignee of action.Assignees || []) {
      if (!assignee.UserId) continue;
      await this.notifications.notify({
        userId: assignee.UserId,
        type: 'comm_action_assigned',
        title: 'You have been assigned an action item',
        body: `[${referenceNumber}] ${subject}: ${action.ActionRequired}`,
        entityType: 'Communication',
        entityId: commId,
      });
    }
  }

  private async recalcCommStatus(commId: number, toggledActionId?: number, isCompleting?: boolean) {
    const allActions = await this.prisma.commAction.findMany({
      where: { CommunicationId: commId },
    });

    const now = new Date();
    let commStatus = 'pending';

    if (allActions.length > 0) {
      const allCompleted = allActions.every(
        (a) => a.Status === 'completed' || (a.Id === toggledActionId && isCompleting),
      );
      if (allCompleted) {
        commStatus = 'completed';
      } else {
        const hasOverdue = allActions.some(
          (a) =>
            a.Status !== 'completed' &&
            !(a.Id === toggledActionId && isCompleting) &&
            a.DueDate !== null && a.DueDate < now,
        );
        const anyInProgress = allActions.some(
          (a) =>
            a.Status === 'in-progress' ||
            (a.Id === toggledActionId && !isCompleting && a.Status !== 'pending'),
        );
        const anyCompleted = allActions.some(
          (a) => a.Status === 'completed' || (a.Id === toggledActionId && isCompleting),
        );
        if (hasOverdue) commStatus = 'overdue';
        else if (anyInProgress || anyCompleted) commStatus = 'in-progress';
      }
    }

    await this.prisma.communication.update({
      where: { Id: commId },
      data: { Status: commStatus },
    });
  }

  async archive(id: number, userId: number, shelfItemId?: number) {
    const existing = await this.prisma.communication.findUnique({ where: { Id: id } });
    if (!existing) throw new NotFoundException('Communication not found');

    await this.prisma.communication.update({
      where: { Id: id },
      data: {
        IsArchived: true,
        ArchivedAt: new Date(),
        ArchivedById: userId,
        ShelfItemId: shelfItemId ?? null,
      },
    });

    await this.audit.log({ entityType: 'Communication', entityId: id, action: 'archive', userId, changes: { after: { shelfItemId } } });
    return this.getDetails(id);
  }

async updateShelf(id: number, shelfItemId?: number, userId?: number) {
    const existing = await this.prisma.communication.findUnique({ where: { Id: id } });
    if (!existing) throw new NotFoundException('Communication not found');

    await this.prisma.communication.update({
      where: { Id: id },
      data: { ShelfItemId: shelfItemId ?? null },
    });

    await this.audit.log({ entityType: 'Communication', entityId: id, action: 'update_shelf', userId, changes: { after: { shelfItemId: shelfItemId ?? null } } });
    return this.getDetails(id);
  }

  async unarchive(id: number, userId: number) {
    const existing = await this.prisma.communication.findUnique({ where: { Id: id } });
    if (!existing) throw new NotFoundException('Communication not found');
    if (!existing.IsArchived) throw new BadRequestException('Communication is not archived');

    await this.prisma.communication.update({
      where: { Id: id },
      data: { IsArchived: false, ArchivedAt: null, ArchivedById: null, ShelfItemId: null },
    });

    await this.audit.log({ entityType: 'Communication', entityId: id, action: 'unarchive', userId });
    return this.getDetails(id);
  }

  async getStats(userId?: number, userRole?: string) {
    const base: any = { IsArchived: false };

    if (userId) {
      const visFilter = await this.buildVisibilityFilter(userId, userRole);
      if (visFilter) {
        base.AND = [visFilter];
      }
    }

    const [total, incoming, outgoing, pending, inProgress, completed, overdue] = await Promise.all([
      this.prisma.communication.count({ where: base }),
      this.prisma.communication.count({ where: { ...base, Type: 'incoming' } }),
      this.prisma.communication.count({ where: { ...base, Type: 'outgoing' } }),
      this.prisma.communication.count({ where: { ...base, Status: 'pending' } }),
      this.prisma.communication.count({ where: { ...base, Status: 'in-progress' } }),
      this.prisma.communication.count({ where: { ...base, Status: 'completed' } }),
      this.prisma.communication.count({ where: { ...base, Status: 'overdue' } }),
    ]);
    return { total, incoming, outgoing, pending, inProgress, completed, overdue };
  }

  // ── Communication Images ───────────────────────────────────────

  async getDetails(id: number) {
    const comm = await this.prisma.communication.findUnique({
      where: { Id: id },
      include: commInclude,
    });
    if (!comm) throw new NotFoundException('Communication not found');

    const formatted = this.formatComm(comm);

    const images = [];
    for (const img of comm.Images) {
      let base64 = '';
      try {
        const buffer = await this.ftpService.downloadFile(img.ImageFile);
        const mimeType = this.ftpService.getMimeType(img.ImageFile);
        base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
      } catch {
        // File not found on FTP
      }
      images.push({
        id: img.Id,
        imageFile: img.ImageFile,
        imageFileType: img.ImageFileType,
        imageFileSize: img.ImageFileSize,
        base64,
      });
    }

    return {
      ...formatted,
      images,
    };
  }

  async uploadImages(commId: number, userId: number, files: Express.Multer.File[]) {
    const comm = await this.prisma.communication.findUnique({ where: { Id: commId } });
    if (!comm) throw new NotFoundException('Communication not found');

    // Validate images
    for (const file of files) {
      try {
        const metadata = await sharp(file.buffer).metadata();
        if (!metadata.width || !metadata.height) throw new Error('Invalid');
      } catch {
        throw new BadRequestException(`Invalid image file: ${file.originalname}`);
      }
    }

    const uploadResults = await this.ftpService.uploadCommFiles(files, comm.ReferenceNumber);

    const imageRecords = uploadResults
      .filter((r) => r.success)
      .map((r, i) => ({
        CommunicationId: commId,
        ImageFile: r.filePath,
        ImageFileType: 'jpeg',
        ImageFileSize: r.fileSize || files[i]?.size || null,
        UploadedById: userId,
      }));

    if (imageRecords.length > 0) {
      await this.prisma.commImage.createMany({ data: imageRecords });
    }

    await this.audit.log({ entityType: 'Communication', entityId: commId, action: 'upload_images', userId, changes: { after: { added: imageRecords.length } } });
    return { added: imageRecords.length };
  }

  async deleteImages(commId: number, imageIds: number[], userId?: number) {
    const images = await this.prisma.commImage.findMany({
      where: { Id: { in: imageIds }, CommunicationId: commId },
    });

    const filePaths = images.map((img) => img.ImageFile);
    if (filePaths.length > 0) {
      await this.ftpService.deleteMultipleFiles(filePaths).catch(() => {});
    }

    await this.prisma.commImage.deleteMany({
      where: { Id: { in: imageIds }, CommunicationId: commId },
    });

    await this.audit.log({ entityType: 'Communication', entityId: commId, action: 'delete_images', userId, changes: { after: { deleted: images.length } } });
    return { deleted: images.length };
  }

  // ── Reply Thread ──────────────────────────────────────────────

  async getReplies(actionId: number) {
    const action = await this.prisma.commAction.findUnique({
      where: { Id: actionId },
      include: { Communication: { select: { ReferenceNumber: true } } },
    });
    if (!action) throw new NotFoundException('Action not found');

    const replies = await this.prisma.commActionReply.findMany({
      where: { ActionId: actionId },
      include: {
        Sender: { select: userSelect },
        Images: true,
      },
      orderBy: { CreatedAt: 'asc' },
    });

    // Download images and convert to base64
    const formatted = [];
    for (const reply of replies) {
      const images = [];
      for (const img of reply.Images) {
        let base64 = '';
        try {
          const buffer = await this.ftpService.downloadFile(img.ImageFile);
          const mimeType = this.ftpService.getMimeType(img.ImageFile);
          base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
        } catch {
          // File not found on FTP
        }
        images.push({
          id: img.Id,
          imageFile: img.ImageFile,
          imageFileType: img.ImageFileType,
          base64,
        });
      }

      formatted.push({
        id: reply.Id,
        actionId: reply.ActionId,
        sender: {
          id: reply.Sender.Id,
          firstName: reply.Sender.FirstName,
          lastName: reply.Sender.LastName,
        },
        content: reply.Content || null,
        images,
        createdAt: reply.CreatedAt.toISOString(),
      });
    }

    return formatted;
  }

  async addReply(
    actionId: number,
    userId: number,
    content?: string,
    files?: Express.Multer.File[],
  ) {
    const action = await this.prisma.commAction.findUnique({
      where: { Id: actionId },
      include: { Communication: { select: { ReferenceNumber: true } } },
    });
    if (!action) throw new NotFoundException('Action not found');

    if (!content?.trim() && (!files || files.length === 0)) {
      throw new BadRequestException('Reply must have content or images');
    }

    // Validate images
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const metadata = await sharp(file.buffer).metadata();
          if (!metadata.width || !metadata.height) {
            throw new Error('Invalid image');
          }
        } catch {
          throw new BadRequestException(`Invalid image file: ${file.originalname}`);
        }
      }
    }

    // Auto-advance action to in-progress on first reply if still pending
    if (action.Status === 'pending') {
      await this.prisma.commAction.update({
        where: { Id: actionId },
        data: { Status: 'in-progress' },
      });
      await this.recalcCommStatus(action.CommunicationId);
    }

    // Create reply record
    const reply = await this.prisma.commActionReply.create({
      data: {
        ActionId: actionId,
        SenderId: userId,
        Content: content?.trim() || null,
      },
    });

    // Upload images to FTP
    if (files && files.length > 0) {
      const refNumber = action.Communication.ReferenceNumber;
      const uploadResults = await this.ftpService.uploadCommReplyFiles(files, refNumber, actionId);

      const imageRecords = uploadResults
        .filter((r) => r.success)
        .map((r, i) => ({
          ReplyId: reply.Id,
          ImageFile: r.filePath,
          ImageFileType: 'jpeg',
          ImageFileSize: r.fileSize || files[i]?.size || null,
          UploadedById: userId,
        }));

      if (imageRecords.length > 0) {
        await this.prisma.commActionReplyImage.createMany({ data: imageRecords });
      }
    }

    // Return the full reply with images
    const fullReply = await this.prisma.commActionReply.findUnique({
      where: { Id: reply.Id },
      include: {
        Sender: { select: userSelect },
        Images: true,
      },
    });

    // Build base64 for freshly uploaded images
    const images = [];
    for (const img of fullReply!.Images) {
      let base64 = '';
      try {
        const buffer = await this.ftpService.downloadFile(img.ImageFile);
        const mimeType = this.ftpService.getMimeType(img.ImageFile);
        base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
      } catch {
        // skip
      }
      images.push({
        id: img.Id,
        imageFile: img.ImageFile,
        imageFileType: img.ImageFileType,
        base64,
      });
    }

    const result = {
      id: fullReply!.Id,
      actionId: fullReply!.ActionId,
      sender: {
        id: fullReply!.Sender.Id,
        firstName: fullReply!.Sender.FirstName,
        lastName: fullReply!.Sender.LastName,
      },
      content: fullReply!.Content || null,
      images,
      createdAt: fullReply!.CreatedAt.toISOString(),
    };

    await this.audit.log({ entityType: 'CommActionReply', entityId: result.id, action: 'create', userId, changes: { after: { actionId, content: content?.trim() || null } } });
    return result;
  }

  async composePdf(
    id: number,
    isBlackAndWhite = false,
    imageIds: number[] = [],
    crops?: { imageId: number; left: number; top: number; width: number; height: number }[],
  ): Promise<{ fileType: string; fileSize: number; base64: string }> {
    const comm = await this.prisma.communication.findUnique({
      where: { Id: id },
      include: { Images: true },
    });
    if (!comm) throw new NotFoundException('Communication not found');

    const selectedImages = imageIds.length > 0
      ? comm.Images.filter((img) => imageIds.includes(img.Id))
      : comm.Images;

    if (selectedImages.length === 0) {
      throw new BadRequestException('No images found for the selected IDs');
    }

    const filePaths = selectedImages.map((img) => img.ImageFile);
    const downloadedFiles = await this.ftpService.downloadMultipleFiles(filePaths);

    const cropMap = new Map<number, { left: number; top: number; width: number; height: number }>();
    if (crops) {
      for (const crop of crops) {
        cropMap.set(crop.imageId, { left: crop.left, top: crop.top, width: crop.width, height: crop.height });
      }
    }
    const imageEntries: { buffer: Buffer; crop?: { left: number; top: number; width: number; height: number } }[] = [];
    for (const img of selectedImages) {
      const buffer = downloadedFiles.get(img.ImageFile);
      if (buffer) imageEntries.push({ buffer, crop: cropMap.get(img.Id) });
    }

    if (imageEntries.length === 0) {
      throw new BadRequestException('Failed to download images for PDF composition');
    }

    const pdfBuffer = await this.ftpService.composeToPdf(imageEntries, isBlackAndWhite, false);
    return {
      fileType: 'pdf',
      fileSize: pdfBuffer.length,
      base64: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
    };
  }

  async deleteReply(replyId: number, userId: number) {
    const reply = await this.prisma.commActionReply.findUnique({
      where: { Id: replyId },
      include: { Images: true },
    });
    if (!reply) throw new NotFoundException('Reply not found');

    // Delete FTP files
    const filePaths = reply.Images.map((img) => img.ImageFile);
    if (filePaths.length > 0) {
      await this.ftpService.deleteMultipleFiles(filePaths).catch(() => {});
    }

    // Delete from DB (cascades to images)
    await this.prisma.commActionReply.delete({ where: { Id: replyId } });
    await this.audit.log({ entityType: 'CommActionReply', entityId: replyId, action: 'delete', userId });
  }
}
