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
import { OtherDocumentService } from './other-document.service';
import { CreateOtherDocumentDto } from './dto/create-other-document.dto';
import { UpdateOtherDocumentDto } from './dto/update-other-document.dto';
import { OtherDocumentQueryDto } from './dto/other-document-query.dto';
import { UpdateOtherDocumentPhotosDto } from './dto/update-photos.dto';
import { CreateDocumentTypeDto, UpdateDocumentTypeDto } from './dto/document-type.dto';
import { ComposePdfDto } from '../vouchers/dto/compose-pdf.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

@ApiTags('Other Documents')
@ApiBearerAuth()
@Controller('other-documents')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OtherDocumentController {
  constructor(private readonly service: OtherDocumentService) {}

  @Get()
  @RequirePermission('other-documents', 'read')
  @ApiOperation({ summary: 'Get all other documents with pagination and filters' })
  findAll(@Query() query: OtherDocumentQueryDto) {
    return this.service.findAll(query);
  }

  @Get('document-types')
  @RequirePermission('document-types', 'read')
  @ApiOperation({ summary: 'Get all other document types' })
  getDocumentTypes() {
    return this.service.getDocumentTypes();
  }

  @Post('document-types')
  @RequirePermission('document-types', 'write')
  @ApiOperation({ summary: 'Create a new document type' })
  createDocumentType(@Body() dto: CreateDocumentTypeDto) {
    return this.service.createDocumentType(dto);
  }

  @Put('document-types/:typeId')
  @RequirePermission('document-types', 'write')
  @ApiOperation({ summary: 'Update a document type' })
  updateDocumentType(
    @Param('typeId', ParseIntPipe) typeId: number,
    @Body() dto: UpdateDocumentTypeDto,
  ) {
    return this.service.updateDocumentType(typeId, dto);
  }

  @Delete('document-types/:typeId')
  @RequirePermission('document-types', 'write')
  @ApiOperation({ summary: 'Delete a document type' })
  removeDocumentType(@Param('typeId', ParseIntPipe) typeId: number) {
    return this.service.deleteDocumentType(typeId);
  }

  @Get(':id')
  @RequirePermission('other-documents', 'read')
  @ApiOperation({ summary: 'Get an other document by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/details')
  @RequirePermission('other-documents', 'read')
  @ApiOperation({ summary: 'Get an other document with photos' })
  findOneWithPhotos(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOneWithPhotos(id);
  }

  @Get(':id/photos')
  @RequirePermission('other-documents', 'read')
  @ApiOperation({ summary: 'Get photos for an other document' })
  getPhotos(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPhotos(id);
  }

  @Post()
  @RequirePermission('other-documents', 'write')
  @ApiOperation({ summary: 'Create a new other document with optional photos' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('photos', 100))
  create(
    @Body() dto: CreateOtherDocumentDto,
    @CurrentUser() user: { Id: number },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.create(dto, user.Id, files);
  }

  @Put(':id')
  @RequirePermission('other-documents', 'write')
  @ApiOperation({ summary: 'Update an other document' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOtherDocumentDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.update(id, dto, user.Id);
  }

  @Put(':id/photos')
  @RequirePermission('other-documents', 'write')
  @ApiOperation({ summary: 'Update photos for an other document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('photos', 100))
  updatePhotos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOtherDocumentPhotosDto,
    @CurrentUser() user: { Id: number },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.updatePhotos(id, user.Id, dto.deletePhotoIds, files);
  }

  @Post(':id/compose-pdf')
  @RequirePermission('other-documents', 'read')
  @ApiOperation({ summary: 'Compose other document images into a PDF for printing' })
  composePdf(
    @Param('id', ParseIntPipe) id: number,
    @Query('color') color?: string,
    @Body() dto?: ComposePdfDto,
  ) {
    const isBlackAndWhite = color === 'bw';
    return this.service.composeDocument(id, isBlackAndWhite, false, dto?.imageIds ?? [], dto?.crops, dto?.watermark, dto?.overrideImages);
  }

  @Delete(':id')
  @RequirePermission('other-documents', 'write')
  @ApiOperation({ summary: 'Delete an other document' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.remove(id, user.Id);
  }
}
