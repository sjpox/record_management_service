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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { VouchersService } from './vouchers.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { BulkCreateVoucherDto } from './dto/bulk-create-voucher.dto';
import { VoucherQueryDto } from './dto/voucher-query.dto';
import { UpdatePhotosDto } from './dto/update-photos.dto';
import { ComposePdfDto } from './dto/compose-pdf.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Vouchers')
@ApiBearerAuth()
@Controller('vouchers')
@UseGuards(JwtAuthGuard)
export class VouchersController {
  constructor(private readonly service: VouchersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all vouchers with pagination and filters' })
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
  @ApiOperation({ summary: 'Get voucher statistics' })
  getStats() {
    return this.service.getStats();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search vouchers by voucher number' })
  search(
    @Query('voucherNo') voucherNo: string,
    @Query('isArchived') isArchived?: string,
  ) {
    const archived = isArchived !== undefined ? isArchived === 'true' : undefined;
    return this.service.search(voucherNo, archived);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a voucher by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/details')
  @ApiOperation({ summary: 'Get a voucher with photos' })
  findOneWithPhotos(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOneWithPhotos(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new voucher with optional photos' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('photos', 20))
  create(
    @Body() dto: CreateVoucherDto,
    @CurrentUser() user: { Id: number },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.create(dto, user.Id, files);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a voucher' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVoucherDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.update(id, dto, user.Id);
  }

  @Get(':id/photos')
  @ApiOperation({ summary: 'Get photos for a voucher' })
  getPhotos(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPhotos(id);
  }

  @Put(':id/photos')
  @ApiOperation({ summary: 'Update photos for a voucher' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('photos', 20))
  updatePhotos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePhotosDto,
    @CurrentUser() user: { Id: number },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.updatePhotos(id, user.Id, dto.deletePhotoIds, files, dto.crops);
  }

  @Post(':id/unarchive')
  @ApiOperation({ summary: 'Unarchive a voucher' })
  unarchive(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.unarchive(id, user.Id);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk create vouchers' })
  bulkCreate(
    @Body() dto: BulkCreateVoucherDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.bulkCreate(dto.vouchers, user.Id);
  }

  @Post(':id/compose-pdf')
  @ApiOperation({ summary: 'Compose voucher images into a PDF for printing' })
  composePdf(
    @Param('id', ParseIntPipe) id: number,
    @Query('color') color?: string,
    @Query('scanEffect') scanEffect?: string,
    @Body() dto?: ComposePdfDto,
  ) {
    const isBlackAndWhite = color === 'bw';
    const isScanEffect = scanEffect === 'true';
    return this.service.composeDocument(id, isBlackAndWhite, isScanEffect, dto?.imageIds ?? [], dto?.crops);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a voucher with optional photos' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('photos', 20))
  archive(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { Id: number },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.archive(id, user.Id, files);
  }
}
