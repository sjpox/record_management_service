import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateResponPersonDto } from './dto/create-respon-person.dto';
import { UpdateResponPersonDto } from './dto/update-respon-person.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { ResponPersons } from '.prisma/client/client';

@Injectable()
export class ResponPersonsService {
  constructor(private prisma: PrismaService) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<ResponPersons>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.responPersons.findMany({ skip, take: limit }),
      this.prisma.responPersons.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<ResponPersons> {
    const item = await this.prisma.responPersons.findUnique({ where: { Id: id } });
    if (!item) throw new NotFoundException(`ResponPerson with ID ${id} not found`);
    return item;
  }

  async create(dto: CreateResponPersonDto): Promise<ResponPersons> {
    return this.prisma.responPersons.create({ data: dto });
  }

  async update(id: number, dto: UpdateResponPersonDto): Promise<ResponPersons> {
    await this.findOne(id);
    return this.prisma.responPersons.update({ where: { Id: id }, data: dto });
  }

  async remove(id: number): Promise<ResponPersons> {
    await this.findOne(id);
    return this.prisma.responPersons.delete({ where: { Id: id } });
  }
}
