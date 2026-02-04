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
import { DocOriginsService } from './doc-origins.service';
import { CreateDocOriginDto } from './dto/create-doc-origin.dto';
import { UpdateDocOriginDto } from './dto/update-doc-origin.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('doc-origins')
export class DocOriginsController {
  constructor(private readonly service: DocOriginsService) {}

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateDocOriginDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDocOriginDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
