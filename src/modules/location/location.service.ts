import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationQueryDto } from './dto/location-query.dto';

const selectFields = {
  Id: true,
  Name: true,
  Type: true,
  ParentId: true,
  DateCreated: true,
  Parent: { select: { Id: true, Name: true, Type: true } },
  Children: {
    select: { Id: true, Name: true, Type: true, ParentId: true, DateCreated: true },
    orderBy: { Name: 'asc' as const },
  },
};

@Injectable()
export class LocationService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(query: LocationQueryDto) {
    const where: Record<string, unknown> = {};

    if (query.type) {
      where.Type = query.type;
    }

    if (query.parentId !== undefined) {
      where.ParentId = query.parentId;
    }

    if (query.search) {
      where.Name = { contains: query.search };
    }

    return this.prisma.location.findMany({
      where,
      select: selectFields,
      orderBy: { Name: 'asc' },
    });
  }

  async findOne(id: number) {
    const location = await this.prisma.location.findUnique({
      where: { Id: id },
      select: selectFields,
    });
    if (!location) throw new NotFoundException(`Location with ID ${id} not found`);
    return location;
  }

  async create(dto: CreateLocationDto, userId: number) {
    if (dto.ParentId) {
      const parent = await this.prisma.location.findUnique({ where: { Id: dto.ParentId } });
      if (!parent) throw new NotFoundException(`Parent location with ID ${dto.ParentId} not found`);

      if (dto.Type === 'building') {
        throw new BadRequestException('A building cannot have a parent');
      }
      if (dto.Type === 'floor' && parent.Type !== 'building') {
        throw new BadRequestException('A floor must belong to a building');
      }
      if (dto.Type === 'room' && parent.Type !== 'floor') {
        throw new BadRequestException('A room must belong to a floor');
      }
    } else if (dto.Type !== 'building') {
      throw new BadRequestException(`A ${dto.Type} must have a parent`);
    }

    const location = await this.prisma.location.create({
      data: {
        Name: dto.Name,
        Type: dto.Type,
        ParentId: dto.ParentId ?? null,
      },
      select: selectFields,
    });

    this.auditService.log({
      entityType: 'Location',
      entityId: location.Id,
      action: 'CREATE',
      userId,
      changes: { after: location },
    });

    return location;
  }

  async update(id: number, dto: UpdateLocationDto, userId: number) {
    const existing = await this.prisma.location.findUnique({ where: { Id: id } });
    if (!existing) throw new NotFoundException(`Location with ID ${id} not found`);

    const updateData: Record<string, unknown> = {};
    if (dto.Name !== undefined) updateData.Name = dto.Name;

    const updated = await this.prisma.location.update({
      where: { Id: id },
      data: updateData,
      select: selectFields,
    });

    this.auditService.log({
      entityType: 'Location',
      entityId: id,
      action: 'UPDATE',
      userId,
      changes: { before: existing, after: updated },
    });

    return updated;
  }

  async remove(id: number, userId: number) {
    const existing = await this.prisma.location.findUnique({
      where: { Id: id },
      select: { ...selectFields, _count: { select: { Children: true } } },
    });
    if (!existing) throw new NotFoundException(`Location with ID ${id} not found`);

    if (existing._count.Children > 0) {
      throw new BadRequestException(
        `Cannot delete location "${existing.Name}" because it has ${existing._count.Children} child location(s)`,
      );
    }

    await this.prisma.location.delete({ where: { Id: id } });

    this.auditService.log({
      entityType: 'Location',
      entityId: id,
      action: 'DELETE',
      userId,
      changes: { before: existing },
    });

    return existing;
  }
}
