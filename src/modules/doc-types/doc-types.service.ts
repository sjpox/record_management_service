import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDocTypeDto } from './dto/create-doc-type.dto';
import { UpdateDocTypeDto } from './dto/update-doc-type.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { DocTypes } from '.prisma/client/client';

@Injectable()
export class DocTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<DocTypes>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.docTypes.findMany({ skip, take: limit }),
      this.prisma.docTypes.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<DocTypes> {
    const item = await this.prisma.docTypes.findUnique({ where: { Id: id } });
    if (!item) throw new NotFoundException(`DocType with ID ${id} not found`);
    return item;
  }

  async create(dto: CreateDocTypeDto): Promise<DocTypes> {
    return this.prisma.docTypes.create({ data: dto });
  }

  async update(id: number, dto: UpdateDocTypeDto): Promise<DocTypes> {
    await this.findOne(id);
    return this.prisma.docTypes.update({ where: { Id: id }, data: dto });
  }

  async remove(id: number): Promise<DocTypes> {
    await this.findOne(id);
    return this.prisma.docTypes.delete({ where: { Id: id } });
  }
}
