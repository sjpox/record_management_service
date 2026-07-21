import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFiles, ParseIntPipe } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CommsService } from './comms.service';
import { CreateCommDto } from './dto/create-comm.dto';
import { UpdateCommDto } from './dto/update-comm.dto';
import { ArchiveCommDto } from './dto/archive-comm.dto';

@ApiTags('Communications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comms')
export class CommsController {
  constructor(private readonly commsService: CommsService) {}

  @Get()
  findAll(
    @CurrentUser() user: { Id: number; Role?: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
    @Query('isArchived') isArchived?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.commsService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      type,
      status,
      priority,
      search,
      isArchived: isArchived === 'true',
      sortBy,
      sortOrder,
      userId: user.Id,
      userRole: user.Role,
    });
  }

  @Get('stats')
  getStats(@CurrentUser() user: { Id: number; Role?: string }) {
    return this.commsService.getStats(user.Id, user.Role);
  }

@Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.commsService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: { Id: number },
    @Body() dto: CreateCommDto,
  ) {
    return this.commsService.create(dto, user.Id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: { Id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommDto,
  ) {
    return this.commsService.update(id, dto, user.Id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { Id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.commsService.remove(id, user.Id);
  }

  @Post(':id/archive')
  archive(
    @CurrentUser() user: { Id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ArchiveCommDto,
  ) {
    return this.commsService.archive(id, user.Id, dto.shelfItemId);
  }

  @Put(':id/shelf')
  updateShelf(
    @CurrentUser() user: { Id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ArchiveCommDto,
  ) {
    return this.commsService.updateShelf(id, dto.shelfItemId, user.Id);
  }

  @Post(':id/unarchive')
  unarchive(
    @CurrentUser() user: { Id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.commsService.unarchive(id, user.Id);
  }

  @Post('actions/:actionId/toggle')
  toggleAction(
    @CurrentUser() user: { Id: number },
    @Param('actionId', ParseIntPipe) actionId: number,
  ) {
    return this.commsService.toggleActionStatus(actionId, user.Id);
  }

  // ── Image Endpoints ────────────────────────────────────────────

  @Post(':id/compose-pdf')
  composePdf(
    @Param('id', ParseIntPipe) id: number,
    @Query('color') color?: string,
    @Body() body?: { imageIds?: number[]; crops?: { imageId: number; left: number; top: number; width: number; height: number }[] },
  ) {
    return this.commsService.composePdf(id, color === 'bw', body?.imageIds ?? [], body?.crops);
  }

  @Get(':id/details')
  getDetails(@Param('id', ParseIntPipe) id: number) {
    return this.commsService.getDetails(id);
  }

  @Post(':id/photos')
  @UseInterceptors(FilesInterceptor('photos', 40))
  uploadImages(
    @CurrentUser() user: { Id: number },
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.commsService.uploadImages(id, user.Id, files);
  }

  @Post(':id/photos/delete')
  deleteImages(
    @CurrentUser() user: { Id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body('imageIds') imageIds: number[],
  ) {
    return this.commsService.deleteImages(id, imageIds, user.Id);
  }

  // ── Reply Thread Endpoints ────────────────────────────────────

  @Get('actions/:actionId/replies')
  getReplies(@Param('actionId', ParseIntPipe) actionId: number) {
    return this.commsService.getReplies(actionId);
  }

  @Post('actions/:actionId/replies')
  @UseInterceptors(FilesInterceptor('photos', 40))
  addReply(
    @CurrentUser() user: { Id: number },
    @Param('actionId', ParseIntPipe) actionId: number,
    @Body('content') content?: string,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.commsService.addReply(actionId, user.Id, content, files);
  }

  @Delete('replies/:replyId')
  deleteReply(
    @CurrentUser() user: { Id: number },
    @Param('replyId', ParseIntPipe) replyId: number,
  ) {
    return this.commsService.deleteReply(replyId, user.Id);
  }
}
