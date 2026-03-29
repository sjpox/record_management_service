import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FtpService } from '../../common/services/ftp.service';
import { AuditService } from '../audit/audit.service';
import { CreateCommDto } from './dto/create-comm.dto';
import { UpdateCommDto } from './dto/update-comm.dto';
import sharp from 'sharp';

const userSelect = { Id: true, FirstName: true, LastName: true };

const commInclude = {
  CreatedBy: { select: userSelect },
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
    };
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    priority?: string;
    search?: string;
  }) {
    const { page = 1, limit = 10, type, status, priority, search } = params;
    const where: any = {};

    if (type && type !== 'all') where.Type = type;
    if (status && status !== 'all') where.Status = status;
    if (priority && priority !== 'all') where.Priority = priority;
    if (search) {
      where.OR = [
        { Subject: { contains: search } },
        { ReferenceNumber: { contains: search } },
        { Sender: { contains: search } },
        { Recipient: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.communication.findMany({
        where,
        include: commInclude,
        orderBy: { CreatedAt: 'desc' },
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
        DateReceived: new Date(dto.dateReceived),
        DateSent: dto.dateSent ? new Date(dto.dateSent) : null,
        Priority: dto.priority || 'normal',
        CreatedById: userId,
        Actions: dto.actions?.length
          ? {
              create: dto.actions.map((a) => ({
                ActionRequired: a.actionRequired,
                DueDate: new Date(a.dueDate),
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
              }
            }
          }
        } else {
          // Create new action with assignees
          await this.prisma.commAction.create({
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
          });
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
    return result;
  }

  async remove(id: number, userId?: number) {
    const existing = await this.prisma.communication.findUnique({ where: { Id: id } });
    if (!existing) throw new NotFoundException('Communication not found');
    await this.prisma.communication.delete({ where: { Id: id } });
    await this.audit.log({ entityType: 'Communication', entityId: id, action: 'delete', userId });
  }

  async toggleActionStatus(actionId: number, userId: number) {
    const action = await this.prisma.commAction.findUnique({ where: { Id: actionId } });
    if (!action) throw new NotFoundException('Action not found');

    const isCompleting = action.Status !== 'completed';
    await this.prisma.commAction.update({
      where: { Id: actionId },
      data: {
        Status: isCompleting ? 'completed' : 'pending',
        CompletedAt: isCompleting ? new Date() : null,
        CompletedById: isCompleting ? userId : null,
      },
    });

    await this.recalcCommStatus(action.CommunicationId, actionId, isCompleting);

    await this.audit.log({ entityType: 'CommAction', entityId: actionId, action: isCompleting ? 'complete' : 'reopen', userId });
    return this.getDetails(action.CommunicationId);
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
        const anyCompleted = allActions.some(
          (a) => a.Status === 'completed' || (a.Id === toggledActionId && isCompleting),
        );
        if (hasOverdue) commStatus = 'overdue';
        else if (anyCompleted) commStatus = 'in-progress';
      }
    }

    await this.prisma.communication.update({
      where: { Id: commId },
      data: { Status: commStatus },
    });
  }

  async getStats() {
    const [total, incoming, outgoing, pending, inProgress, completed, overdue] = await Promise.all([
      this.prisma.communication.count(),
      this.prisma.communication.count({ where: { Type: 'incoming' } }),
      this.prisma.communication.count({ where: { Type: 'outgoing' } }),
      this.prisma.communication.count({ where: { Status: 'pending' } }),
      this.prisma.communication.count({ where: { Status: 'in-progress' } }),
      this.prisma.communication.count({ where: { Status: 'completed' } }),
      this.prisma.communication.count({ where: { Status: 'overdue' } }),
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
