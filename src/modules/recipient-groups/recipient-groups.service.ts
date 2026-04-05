import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRecipientGroupDto } from './dto/create-recipient-group.dto';
import { UpdateRecipientGroupDto } from './dto/update-recipient-group.dto';
import { randomBytes } from 'crypto';

const groupInclude = {
  Members: {
    include: {
      User: { select: { Id: true, FirstName: true, LastName: true, Section: true } },
    },
  },
  CreatedBy: { select: { Id: true, FirstName: true, LastName: true } },
};

@Injectable()
export class RecipientGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private formatGroup(group: any) {
    return {
      id: group.Id,
      name: group.Name,
      status: group.Status,
      version: group.Version,
      groupKey: group.GroupKey,
      members: (group.Members || []).map((m: any) => ({
        id: m.Id,
        userId: m.UserId,
        firstName: m.User.FirstName,
        lastName: m.User.LastName,
        section: m.User.Section || null,
      })),
      createdBy: group.CreatedBy
        ? { id: group.CreatedBy.Id, firstName: group.CreatedBy.FirstName, lastName: group.CreatedBy.LastName }
        : null,
      createdAt: group.CreatedAt.toISOString(),
    };
  }

  async findAll(params: { page?: number; limit?: number; search?: string; includeInactive?: boolean }) {
    const { page = 1, limit = 50, search, includeInactive = false } = params;
    const where: any = {};

    if (!includeInactive) {
      where.Status = 'active';
    }

    if (search) {
      where.Name = { contains: search };
    }

    const [data, total] = await Promise.all([
      this.prisma.recipientGroup.findMany({
        where,
        include: groupInclude,
        orderBy: { Name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.recipientGroup.count({ where }),
    ]);

    return {
      data: data.map((g) => this.formatGroup(g)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const group = await this.prisma.recipientGroup.findUnique({
      where: { Id: id },
      include: groupInclude,
    });
    if (!group) throw new NotFoundException('Group not found');
    return this.formatGroup(group);
  }

  /** Get the latest active version of a group by its groupKey */
  async findByGroupKey(groupKey: string) {
    const group = await this.prisma.recipientGroup.findFirst({
      where: { GroupKey: groupKey, Status: 'active' },
      include: groupInclude,
    });
    if (!group) throw new NotFoundException('Group not found');
    return this.formatGroup(group);
  }

  async create(dto: CreateRecipientGroupDto, userId: number) {
    // Validate all user IDs exist
    const users = await this.prisma.users.findMany({
      where: { Id: { in: dto.userIds }, IsActive: true },
      select: { Id: true },
    });
    if (users.length !== dto.userIds.length) {
      throw new BadRequestException('One or more user IDs are invalid or inactive');
    }

    const groupKey = randomBytes(8).toString('hex');

    const group = await this.prisma.recipientGroup.create({
      data: {
        Name: dto.name.trim(),
        GroupKey: groupKey,
        Version: 1,
        Status: 'active',
        CreatedById: userId,
        Members: {
          create: dto.userIds.map((uid) => ({ UserId: uid })),
        },
      },
      include: groupInclude,
    });

    const result = this.formatGroup(group);
    await this.audit.log({ entityType: 'RecipientGroup', entityId: group.Id, action: 'create', userId, changes: { after: result } });
    return result;
  }

  /**
   * Update creates a new version of the group.
   * The old version is set to inactive so historical data is preserved.
   */
  async update(id: number, dto: UpdateRecipientGroupDto, userId: number) {
    const existing = await this.prisma.recipientGroup.findUnique({
      where: { Id: id },
      include: { Members: true },
    });
    if (!existing) throw new NotFoundException('Group not found');
    if (existing.Status !== 'active') throw new BadRequestException('Cannot update an inactive group version');

    const newName = dto.name?.trim() || existing.Name;
    const newUserIds = dto.userIds || existing.Members.map((m) => m.UserId);

    // Validate user IDs
    if (dto.userIds) {
      const users = await this.prisma.users.findMany({
        where: { Id: { in: dto.userIds }, IsActive: true },
        select: { Id: true },
      });
      if (users.length !== dto.userIds.length) {
        throw new BadRequestException('One or more user IDs are invalid or inactive');
      }
    }

    // Check if anything actually changed
    const existingUserIds = existing.Members.map((m) => m.UserId).sort();
    const incomingUserIds = [...newUserIds].sort();
    const membersChanged = existingUserIds.length !== incomingUserIds.length ||
      existingUserIds.some((id, i) => id !== incomingUserIds[i]);
    const nameChanged = newName !== existing.Name;

    if (!nameChanged && !membersChanged) {
      return this.findOne(id);
    }

    // Create new version and deactivate old one in a transaction
    const newGroup = await this.prisma.$transaction(async (tx) => {
      // Deactivate old version
      await tx.recipientGroup.update({
        where: { Id: id },
        data: { Status: 'inactive' },
      });

      // Create new version with same groupKey
      return tx.recipientGroup.create({
        data: {
          Name: newName,
          GroupKey: existing.GroupKey,
          Version: existing.Version + 1,
          Status: 'active',
          CreatedById: userId,
          Members: {
            create: newUserIds.map((uid) => ({ UserId: uid })),
          },
        },
        include: groupInclude,
      });
    });

    const result = this.formatGroup(newGroup);
    await this.audit.log({ entityType: 'RecipientGroup', entityId: newGroup.Id, action: 'update', userId, changes: { before: { id, version: existing.Version }, after: result } });
    return result;
  }

  async remove(id: number, userId: number) {
    const existing = await this.prisma.recipientGroup.findUnique({ where: { Id: id } });
    if (!existing) throw new NotFoundException('Group not found');

    // Deactivate all versions of this group
    await this.prisma.recipientGroup.updateMany({
      where: { GroupKey: existing.GroupKey },
      data: { Status: 'inactive' },
    });

    await this.audit.log({ entityType: 'RecipientGroup', entityId: id, action: 'delete', userId });
  }
}
