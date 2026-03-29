import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCabinetDto } from './dto/create-cabinet.dto';
import { UpdateCabinetDto } from './dto/update-cabinet.dto';
import { CabinetQueryDto } from './dto/cabinet-query.dto';
import { CreateShelfDto } from './dto/create-shelf.dto';
import { UpdateShelfDto } from './dto/update-shelf.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { Cabinet } from '@prisma/client';

const locationSelect = { select: { Id: true, Name: true, Type: true } };

const cabinetSelectFields = {
  Id: true,
  Name: true,
  Color: true,
  BuildingId: true,
  FloorId: true,
  RoomId: true,
  Building: locationSelect,
  Floor: locationSelect,
  Room: locationSelect,
  X: true,
  Y: true,
  Width: true,
  Height: true,
  DateCreated: true,
  DateLastUpdated: true,
  Shelves: {
    select: {
      Id: true,
      Name: true,
      Location: true,
      CabinetId: true,
      DateCreated: true,
      DateLastUpdated: true,
      Items: {
        select: {
          Id: true,
          Label: true,
          Description: true,
          Category: true,
          ShelfId: true,
          DateCreated: true,
          DateLastUpdated: true,
        },
      },
      _count: { select: { Items: true } },
    },
  },
  _count: {
    select: { Shelves: true },
  },
};

const cabinetWithShelvesSelect = {
  ...cabinetSelectFields,
  Shelves: {
    select: {
      Id: true,
      Name: true,
      Location: true,
      CabinetId: true,
      DateCreated: true,
      DateLastUpdated: true,
      Items: {
        select: {
          Id: true,
          Label: true,
          Description: true,
          Category: true,
          ShelfId: true,
          DateCreated: true,
          DateLastUpdated: true,
        },
      },
      _count: { select: { Items: true } },
    },
  },
};

@Injectable()
export class ShelfMapService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // ---- Cabinets ----

  async findAllCabinets(query: CabinetQueryDto): Promise<PaginatedResult<Cabinet>> {
    const { page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.buildingId) {
      where.BuildingId = query.buildingId;
    }
    if (query.floorId) {
      where.FloorId = query.floorId;
    }
    if (query.roomId) {
      where.RoomId = query.roomId;
    }
    if (query.search) {
      where.OR = [
        { Name: { contains: query.search } },
        { Building: { Name: { contains: query.search } } },
        { Floor: { Name: { contains: query.search } } },
        { Room: { Name: { contains: query.search } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.cabinet.findMany({
        skip,
        take: limit,
        where,
        select: cabinetSelectFields,
        orderBy: { DateCreated: 'desc' },
      }),
      this.prisma.cabinet.count({ where }),
    ]);

    return {
      data: data as unknown as Cabinet[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOneCabinet(id: number) {
    const cabinet = await this.prisma.cabinet.findUnique({
      where: { Id: id },
      select: cabinetWithShelvesSelect,
    });
    if (!cabinet) throw new NotFoundException(`Cabinet with ID ${id} not found`);
    return cabinet;
  }

  async createCabinet(dto: CreateCabinetDto, userId: number) {
    const cabinet = await this.prisma.cabinet.create({
      data: {
        Name: dto.Name,
        Color: dto.Color,
        BuildingId: dto.BuildingId ?? null,
        FloorId: dto.FloorId ?? null,
        RoomId: dto.RoomId ?? null,
        X: dto.X ?? 0,
        Y: dto.Y ?? 0,
        Width: dto.Width ?? 100,
        Height: dto.Height ?? 60,
      },
      select: cabinetSelectFields,
    });

    this.auditService.log({
      entityType: 'Cabinet',
      entityId: cabinet.Id,
      action: 'CREATE',
      userId,
      changes: { after: cabinet },
    });

    return cabinet;
  }

  async updateCabinet(id: number, dto: UpdateCabinetDto, userId: number) {
    const existing = await this.prisma.cabinet.findUnique({ where: { Id: id } });
    if (!existing) throw new NotFoundException(`Cabinet with ID ${id} not found`);

    const updateData: Record<string, unknown> = {};
    if (dto.Name !== undefined) updateData.Name = dto.Name;
    if (dto.Color !== undefined) updateData.Color = dto.Color;
    if (dto.BuildingId !== undefined) updateData.BuildingId = dto.BuildingId ?? null;
    if (dto.FloorId !== undefined) updateData.FloorId = dto.FloorId ?? null;
    if (dto.RoomId !== undefined) updateData.RoomId = dto.RoomId ?? null;
    if (dto.X !== undefined) updateData.X = dto.X;
    if (dto.Y !== undefined) updateData.Y = dto.Y;
    if (dto.Width !== undefined) updateData.Width = dto.Width;
    if (dto.Height !== undefined) updateData.Height = dto.Height;

    const updated = await this.prisma.cabinet.update({
      where: { Id: id },
      data: updateData,
      select: cabinetSelectFields,
    });

    this.auditService.log({
      entityType: 'Cabinet',
      entityId: id,
      action: 'UPDATE',
      userId,
      changes: { before: existing, after: updated },
    });

    return updated;
  }

  async removeCabinet(id: number, userId: number) {
    const existing = await this.prisma.cabinet.findUnique({
      where: { Id: id },
      select: cabinetSelectFields,
    });
    if (!existing) throw new NotFoundException(`Cabinet with ID ${id} not found`);

    await this.prisma.cabinet.delete({ where: { Id: id } });

    this.auditService.log({
      entityType: 'Cabinet',
      entityId: id,
      action: 'DELETE',
      userId,
      changes: { before: existing },
    });

    return existing;
  }

  // ---- Shelves ----

  async findShelves(cabinetId: number) {
    await this.ensureCabinetExists(cabinetId);
    return this.prisma.shelf.findMany({
      where: { CabinetId: cabinetId },
      select: {
        Id: true,
        Name: true,
        Location: true,
        CabinetId: true,
        DateCreated: true,
        DateLastUpdated: true,
        Items: {
          select: {
            Id: true,
            Label: true,
            Description: true,
            Category: true,
            ShelfId: true,
            DateCreated: true,
            DateLastUpdated: true,
          },
        },
        _count: { select: { Items: true } },
      },
      orderBy: { DateCreated: 'asc' },
    });
  }

  async createShelf(cabinetId: number, dto: CreateShelfDto, userId: number) {
    await this.ensureCabinetExists(cabinetId);

    const shelf = await this.prisma.shelf.create({
      data: {
        Name: dto.Name,
        Location: dto.Location,
        CabinetId: cabinetId,
      },
    });

    this.auditService.log({
      entityType: 'Shelf',
      entityId: shelf.Id,
      action: 'CREATE',
      userId,
      changes: { after: shelf },
    });

    return shelf;
  }

  async updateShelf(cabinetId: number, shelfId: number, dto: UpdateShelfDto, userId: number) {
    await this.ensureCabinetExists(cabinetId);
    const existing = await this.prisma.shelf.findFirst({
      where: { Id: shelfId, CabinetId: cabinetId },
    });
    if (!existing) throw new NotFoundException(`Shelf with ID ${shelfId} not found in cabinet ${cabinetId}`);

    const updateData: Record<string, unknown> = {};
    if (dto.Name !== undefined) updateData.Name = dto.Name;
    if (dto.Location !== undefined) updateData.Location = dto.Location;

    const updated = await this.prisma.shelf.update({
      where: { Id: shelfId },
      data: updateData,
    });

    this.auditService.log({
      entityType: 'Shelf',
      entityId: shelfId,
      action: 'UPDATE',
      userId,
      changes: { before: existing, after: updated },
    });

    return updated;
  }

  async removeShelf(cabinetId: number, shelfId: number, userId: number) {
    await this.ensureCabinetExists(cabinetId);
    const existing = await this.prisma.shelf.findFirst({
      where: { Id: shelfId, CabinetId: cabinetId },
    });
    if (!existing) throw new NotFoundException(`Shelf with ID ${shelfId} not found in cabinet ${cabinetId}`);

    await this.prisma.shelf.delete({ where: { Id: shelfId } });

    this.auditService.log({
      entityType: 'Shelf',
      entityId: shelfId,
      action: 'DELETE',
      userId,
      changes: { before: existing },
    });

    return existing;
  }

  // ---- Items ----

  async findItems(cabinetId: number, shelfId: number) {
    await this.ensureShelfExists(cabinetId, shelfId);
    return this.prisma.shelfItem.findMany({
      where: { ShelfId: shelfId },
      orderBy: { DateCreated: 'asc' },
    });
  }

  async createItem(cabinetId: number, shelfId: number, dto: CreateItemDto, userId: number) {
    await this.ensureShelfExists(cabinetId, shelfId);

    const item = await this.prisma.shelfItem.create({
      data: {
        Label: dto.Label,
        Description: dto.Description,
        Category: dto.Category,
        ShelfId: shelfId,
      },
    });

    this.auditService.log({
      entityType: 'ShelfItem',
      entityId: item.Id,
      action: 'CREATE',
      userId,
      changes: { after: item },
    });

    return item;
  }

  async updateItem(cabinetId: number, shelfId: number, itemId: number, dto: UpdateItemDto, userId: number) {
    await this.ensureShelfExists(cabinetId, shelfId);
    const existing = await this.prisma.shelfItem.findFirst({
      where: { Id: itemId, ShelfId: shelfId },
    });
    if (!existing) throw new NotFoundException(`Item with ID ${itemId} not found in shelf ${shelfId}`);

    const updateData: Record<string, unknown> = {};
    if (dto.Label !== undefined) updateData.Label = dto.Label;
    if (dto.Description !== undefined) updateData.Description = dto.Description;
    if (dto.Category !== undefined) updateData.Category = dto.Category;

    const updated = await this.prisma.shelfItem.update({
      where: { Id: itemId },
      data: updateData,
    });

    this.auditService.log({
      entityType: 'ShelfItem',
      entityId: itemId,
      action: 'UPDATE',
      userId,
      changes: { before: existing, after: updated },
    });

    return updated;
  }

  async removeItem(cabinetId: number, shelfId: number, itemId: number, userId: number) {
    await this.ensureShelfExists(cabinetId, shelfId);
    const existing = await this.prisma.shelfItem.findFirst({
      where: { Id: itemId, ShelfId: shelfId },
    });
    if (!existing) throw new NotFoundException(`Item with ID ${itemId} not found in shelf ${shelfId}`);

    await this.prisma.shelfItem.delete({ where: { Id: itemId } });

    this.auditService.log({
      entityType: 'ShelfItem',
      entityId: itemId,
      action: 'DELETE',
      userId,
      changes: { before: existing },
    });

    return existing;
  }

  // ---- Helpers ----

  private async ensureCabinetExists(cabinetId: number) {
    const cabinet = await this.prisma.cabinet.findUnique({ where: { Id: cabinetId } });
    if (!cabinet) throw new NotFoundException(`Cabinet with ID ${cabinetId} not found`);
    return cabinet;
  }

  private async ensureShelfExists(cabinetId: number, shelfId: number) {
    await this.ensureCabinetExists(cabinetId);
    const shelf = await this.prisma.shelf.findFirst({
      where: { Id: shelfId, CabinetId: cabinetId },
    });
    if (!shelf) throw new NotFoundException(`Shelf with ID ${shelfId} not found in cabinet ${cabinetId}`);
    return shelf;
  }
}
