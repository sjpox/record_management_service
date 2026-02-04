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
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { OutGoingsService } from './out-goings.service';
import { CreateOutGoingDto } from './dto/create-out-going.dto';
import { UpdateOutGoingDto } from './dto/update-out-going.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('out-goings')
export class OutGoingsController {
  constructor(private readonly service: OutGoingsService) {}

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Get('search')
  search(@Query('q') searchTerm: string) {
    return this.service.search(searchTerm);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('photos', 10))
  create(
    @Body() dto: CreateOutGoingDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.create(dto, files);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOutGoingDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/photos')
  @UseInterceptors(FilesInterceptor('photos', 10))
  addPhotos(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.service.addPhotos(id, files);
  }

  @Delete(':id/photos/:photoId')
  deletePhoto(@Param('photoId', ParseIntPipe) photoId: number) {
    return this.service.deletePhoto(photoId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
