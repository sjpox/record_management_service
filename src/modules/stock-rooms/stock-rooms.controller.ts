import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { StockRoomsService } from './stock-rooms.service';
import { CreateStockRoomDto } from './dto/create-stock-room.dto';
import { UpdateStockRoomDto } from './dto/update-stock-room.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('stock-rooms')
export class StockRoomsController {
  constructor(private readonly service: StockRoomsService) {}

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateStockRoomDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStockRoomDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
