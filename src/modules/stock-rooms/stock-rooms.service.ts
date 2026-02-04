import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStockRoomDto } from './dto/create-stock-room.dto';
import { UpdateStockRoomDto } from './dto/update-stock-room.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { StockRooms } from '.prisma/client/client';

@Injectable()
export class StockRoomsService {
  constructor(private prisma: PrismaService) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<StockRooms>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.stockRooms.findMany({ skip, take: limit }),
      this.prisma.stockRooms.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<StockRooms> {
    const item = await this.prisma.stockRooms.findUnique({ where: { Id: id } });
    if (!item) throw new NotFoundException(`StockRoom with ID ${id} not found`);
    return item;
  }

  async create(dto: CreateStockRoomDto): Promise<StockRooms> {
    return this.prisma.stockRooms.create({ data: dto });
  }

  async update(id: number, dto: UpdateStockRoomDto): Promise<StockRooms> {
    await this.findOne(id);
    return this.prisma.stockRooms.update({ where: { Id: id }, data: dto });
  }

  async remove(id: number): Promise<StockRooms> {
    await this.findOne(id);
    return this.prisma.stockRooms.delete({ where: { Id: id } });
  }
}
