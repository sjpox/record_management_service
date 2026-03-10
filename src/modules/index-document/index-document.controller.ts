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
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { IndexDocumentService } from './index-document.service';
import { CreateIndexDocumentDto } from './dto/create-index-document.dto';
import { UpdateIndexDocumentDto } from './dto/update-index-document.dto';
import { IndexDocumentQueryDto } from './dto/index-document-query.dto';
import { UpdateIndexDocumentPhotosDto } from './dto/update-photos.dto';
import { ComposePdfDto } from '../vouchers/dto/compose-pdf.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Index Documents')
@ApiBearerAuth()
@Controller('index-documents')
@UseGuards(JwtAuthGuard)
export class IndexDocumentController {
  constructor(private readonly service: IndexDocumentService) {}

  @Get()
  @ApiOperation({ summary: 'Get all index documents with pagination and filters' })
  findAll(@Query() query: IndexDocumentQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an index document by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/details')
  @ApiOperation({ summary: 'Get an index document with photos' })
  findOneWithPhotos(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOneWithPhotos(id);
  }

  @Get(':id/photos')
  @ApiOperation({ summary: 'Get photos for an index document' })
  getPhotos(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPhotos(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new index document with optional photos' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('photos', 100))
  create(
    @Body() dto: CreateIndexDocumentDto,
    @CurrentUser() user: { Id: number },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.create(dto, user.Id, files);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an index document' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIndexDocumentDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.update(id, dto, user.Id);
  }

  @Put(':id/photos')
  @ApiOperation({ summary: 'Update photos for an index document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('photos', 100))
  updatePhotos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIndexDocumentPhotosDto,
    @CurrentUser() user: { Id: number },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.updatePhotos(id, user.Id, dto.deletePhotoIds, files);
  }

  @Post(':id/compose-pdf')
  @ApiOperation({ summary: 'Compose index document images into a PDF for printing' })
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

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an index document' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.remove(id, user.Id);
  }
}
