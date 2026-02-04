import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReceiverDto } from './dto/create-receiver.dto';
import { UpdateReceiverDto } from './dto/update-receiver.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { Receivers } from '.prisma/client/client';

@Injectable()
export class ReceiversService {
  constructor(private prisma: PrismaService) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<Receivers>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.receivers.findMany({ skip, take: limit }),
      this.prisma.receivers.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Receivers> {
    const item = await this.prisma.receivers.findUnique({ where: { Id: id } });
    if (!item) throw new NotFoundException(`Receiver with ID ${id} not found`);
    return item;
  }

  async create(dto: CreateReceiverDto): Promise<Receivers> {
    return this.prisma.receivers.create({ data: dto });
  }

  async update(id: number, dto: UpdateReceiverDto): Promise<Receivers> {
    await this.findOne(id);
    return this.prisma.receivers.update({ where: { Id: id }, data: dto });
  }

  async remove(id: number): Promise<Receivers> {
    await this.findOne(id);
    return this.prisma.receivers.delete({ where: { Id: id } });
  }
}
