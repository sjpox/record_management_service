import { Body, Controller, Delete, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from './permission.guard';
import { PermissionsService } from './permissions.service';
import { RequirePermission } from './require-permission.decorator';

class UpsertPermissionDto {
  @IsString() role: string;
  @IsString() resource: string;
  @IsString() action: string;
  @IsBoolean() allowed: boolean;
}

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Get()
  @RequirePermission('permissions', 'read')
  @ApiOperation({ summary: 'List all role permission entries' })
  getAll() {
    return this.service.getAll();
  }

  @Put()
  @RequirePermission('permissions', 'write')
  @ApiOperation({ summary: 'Upsert a role permission entry' })
  upsert(@Body() dto: UpsertPermissionDto) {
    return this.service.upsert(dto.role, dto.resource, dto.action, dto.allowed);
  }

  @Delete(':id')
  @RequirePermission('permissions', 'write')
  @ApiOperation({ summary: 'Delete a role permission override' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
