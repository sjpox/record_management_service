import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { VouchersService } from './vouchers.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { BulkCreateVoucherDto } from './dto/bulk-create-voucher.dto';
import { VoucherQueryDto } from './dto/voucher-query.dto';
import { UpdatePhotosDto } from './dto/update-photos.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('vouchers')
@UseGuards(JwtAuthGuard)
export class VouchersController {
  constructor(private readonly service: VouchersService) {}

  @Get()
  findAll(@Query() query: VoucherQueryDto) {
    const isArchived = query.isArchived !== undefined ? query.isArchived === 'true' : undefined;
    const filters = {
      voucherNo: query.voucherNo,
      transactionNo: query.transactionNo,
      payee: query.payee,
      claimType: query.claimType,
    };
    return this.service.findAll(query, isArchived, query.search, filters);
  }

  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  @Get('search')
  search(
    @Query('voucherNo') voucherNo: string,
    @Query('isArchived') isArchived?: string,
  ) {
    const archived = isArchived !== undefined ? isArchived === 'true' : undefined;
    return this.service.search(voucherNo, archived);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/details')
  findOneWithPhotos(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOneWithPhotos(id);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('photos', 10))
  create(
    @Body() dto: CreateVoucherDto,
    @CurrentUser() user: { Id: number },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.create(dto, user.Id, files);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVoucherDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.update(id, dto, user.Id);
  }

  @Get(':id/photos')
  getPhotos(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPhotos(id);
  }

  @Put(':id/photos')
  @UseInterceptors(FilesInterceptor('photos'))
  updatePhotos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePhotosDto,
    @CurrentUser() user: { Id: number },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.updatePhotos(id, user.Id, dto.deletePhotoIds, files);
  }

  @Post(':id/unarchive')
  unarchive(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.unarchive(id, user.Id);
  }

  @Post('bulk')
  bulkCreate(
    @Body() dto: BulkCreateVoucherDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.bulkCreate(dto.vouchers, user.Id);
  }

  @Post(':id/archive')
  @UseInterceptors(FilesInterceptor('photos', 10))
  archive(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { Id: number },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.archive(id, user.Id, files);
  }
}
