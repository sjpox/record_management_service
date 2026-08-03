import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@ApiTags('Announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @RequirePermission('announcements', 'read')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.announcementsService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      search,
      category,
      status,
      priority,
      activeOnly: activeOnly === 'true',
    });
  }

  @Get(':id')
  @RequirePermission('announcements', 'read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.announcementsService.findOne(id);
  }

  @Post()
  @RequirePermission('announcements', 'write')
  create(
    @CurrentUser() user: { Id: number },
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.create(dto, user.Id);
  }

  @Put(':id')
  @RequirePermission('announcements', 'write')
  update(
    @CurrentUser() user: { Id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(id, dto, user.Id);
  }

  @Delete(':id')
  @RequirePermission('announcements', 'write')
  remove(
    @CurrentUser() user: { Id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.announcementsService.remove(id, user.Id);
  }
}
