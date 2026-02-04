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
import { ResponPersonsService } from './respon-persons.service';
import { CreateResponPersonDto } from './dto/create-respon-person.dto';
import { UpdateResponPersonDto } from './dto/update-respon-person.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('respon-persons')
export class ResponPersonsController {
  constructor(private readonly service: ResponPersonsService) {}

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateResponPersonDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateResponPersonDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
