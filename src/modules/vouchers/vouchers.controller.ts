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
import { VouchersService } from './vouchers.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { BulkCreateVoucherDto } from './dto/bulk-create-voucher.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('vouchers')
export class VouchersController {
  constructor(private readonly service: VouchersService) {}

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Get('search')
  search(@Query('voucherNo') voucherNo: string) {
    return this.service.search(voucherNo);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('photos', 10))
  create(
    @Body() dto: CreateVoucherDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.create(dto, files);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVoucherDto) {
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

  @Post('bulk')
  bulkCreate(@Body() dto: BulkCreateVoucherDto) {
    return this.service.bulkCreate(dto.vouchers);
  }
}
