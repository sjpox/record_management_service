import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDocOriginDto } from './dto/create-doc-origin.dto';
import { UpdateDocOriginDto } from './dto/update-doc-origin.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { DocOrigins } from '.prisma/client/client';

@Injectable()
export class DocOriginsService {
  constructor(private prisma: PrismaService) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<DocOrigins>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.docOrigins.findMany({ skip, take: limit }),
      this.prisma.docOrigins.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<DocOrigins> {
    const item = await this.prisma.docOrigins.findUnique({ where: { Id: id } });
    if (!item) throw new NotFoundException(`DocOrigin with ID ${id} not found`);
    return item;
  }

  async create(dto: CreateDocOriginDto): Promise<DocOrigins> {
    return this.prisma.docOrigins.create({ data: dto });
  }

  async update(id: number, dto: UpdateDocOriginDto): Promise<DocOrigins> {
    await this.findOne(id);
    return this.prisma.docOrigins.update({ where: { Id: id }, data: dto });
  }

  async remove(id: number): Promise<DocOrigins> {
    await this.findOne(id);
    return this.prisma.docOrigins.delete({ where: { Id: id } });
  }
}
