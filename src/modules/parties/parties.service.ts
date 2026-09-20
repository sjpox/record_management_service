import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';

@Injectable()
export class PartiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { page?: number; limit?: number; search?: string; includeInactive?: boolean }) {
    const { page = 1, limit = 50, search, includeInactive = false } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (!includeInactive) where.IsActive = true;
    if (search) {
      where.OR = [
        { Name: { contains: search } },
        { ShortName: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.party.findMany({
        where,
        orderBy: { Name: 'asc' },
        skip,
        take: limit,
        select: { Id: true, Name: true, ShortName: true, Type: true, IsActive: true, CreatedAt: true, UpdatedAt: true },
      }),
      this.prisma.party.count({ where }),
    ]);

    return {
      data: data.map(this.format),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const party = await this.prisma.party.findUnique({
      where: { Id: id },
      select: { Id: true, Name: true, ShortName: true, Type: true, IsActive: true, CreatedAt: true, UpdatedAt: true },
    });
    if (!party) throw new NotFoundException(`Party #${id} not found`);
    return this.format(party);
  }

  async create(dto: CreatePartyDto) {
    const party = await this.prisma.party.create({
      data: { Name: dto.name, ShortName: dto.shortName ?? null, Type: dto.type ?? 'organization' },
      select: { Id: true, Name: true, ShortName: true, Type: true, IsActive: true, CreatedAt: true, UpdatedAt: true },
    });
    return this.format(party);
  }

  async update(id: number, dto: UpdatePartyDto) {
    await this.findOne(id);
    const party = await this.prisma.party.update({
      where: { Id: id },
      data: {
        ...(dto.name !== undefined && { Name: dto.name }),
        ...(dto.shortName !== undefined && { ShortName: dto.shortName }),
        ...(dto.type !== undefined && { Type: dto.type }),
        ...(dto.isActive !== undefined && { IsActive: dto.isActive }),
      },
      select: { Id: true, Name: true, ShortName: true, Type: true, IsActive: true, CreatedAt: true, UpdatedAt: true },
    });
    return this.format(party);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.party.delete({ where: { Id: id } });
    return { success: true };
  }

  private format(p: { Id: number; Name: string; ShortName: string | null; Type: string; IsActive: boolean; CreatedAt: Date; UpdatedAt: Date }) {
    return {
      id: p.Id,
      name: p.Name,
      shortName: p.ShortName,
      type: p.Type,
      isActive: p.IsActive,
      createdAt: p.CreatedAt.toISOString(),
      updatedAt: p.UpdatedAt.toISOString(),
    };
  }
}
