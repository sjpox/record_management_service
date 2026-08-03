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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShelfMapService } from './shelf-map.service';
import { CabinetQueryDto } from './dto/cabinet-query.dto';
import { CreateCabinetDto } from './dto/create-cabinet.dto';
import { UpdateCabinetDto } from './dto/update-cabinet.dto';
import { CreateShelfDto } from './dto/create-shelf.dto';
import { UpdateShelfDto } from './dto/update-shelf.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

@ApiTags('Shelf Map')
@ApiBearerAuth()
@Controller('shelf-map')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ShelfMapController {
  constructor(private readonly service: ShelfMapService) {}

  // ---- Cabinets ----

  @Get('cabinets')
  @RequirePermission('shelf-map', 'read')
  @ApiOperation({ summary: 'Get all cabinets with pagination and filters' })
  findAllCabinets(@Query() query: CabinetQueryDto) {
    return this.service.findAllCabinets(query);
  }

  @Get('cabinets/:id')
  @RequirePermission('shelf-map', 'read')
  @ApiOperation({ summary: 'Get a cabinet by ID with shelves and items' })
  findOneCabinet(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOneCabinet(id);
  }

  @Post('cabinets')
  @RequirePermission('shelf-map', 'write')
  @ApiOperation({ summary: 'Create a new cabinet' })
  createCabinet(
    @Body() dto: CreateCabinetDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.createCabinet(dto, user.Id);
  }

  @Put('cabinets/:id')
  @RequirePermission('shelf-map', 'write')
  @ApiOperation({ summary: 'Update a cabinet' })
  updateCabinet(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCabinetDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.updateCabinet(id, dto, user.Id);
  }

  @Delete('cabinets/:id')
  @RequirePermission('shelf-map', 'write')
  @ApiOperation({ summary: 'Delete a cabinet and all its shelves/items' })
  removeCabinet(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.removeCabinet(id, user.Id);
  }

  // ---- Shelves ----

  @Get('cabinets/:cabinetId/shelves')
  @RequirePermission('shelf-map', 'read')
  @ApiOperation({ summary: 'Get all shelves for a cabinet' })
  findShelves(@Param('cabinetId', ParseIntPipe) cabinetId: number) {
    return this.service.findShelves(cabinetId);
  }

  @Post('cabinets/:cabinetId/shelves')
  @RequirePermission('shelf-map', 'write')
  @ApiOperation({ summary: 'Create a shelf in a cabinet' })
  createShelf(
    @Param('cabinetId', ParseIntPipe) cabinetId: number,
    @Body() dto: CreateShelfDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.createShelf(cabinetId, dto, user.Id);
  }

  @Put('cabinets/:cabinetId/shelves/:shelfId')
  @RequirePermission('shelf-map', 'write')
  @ApiOperation({ summary: 'Update a shelf' })
  updateShelf(
    @Param('cabinetId', ParseIntPipe) cabinetId: number,
    @Param('shelfId', ParseIntPipe) shelfId: number,
    @Body() dto: UpdateShelfDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.updateShelf(cabinetId, shelfId, dto, user.Id);
  }

  @Delete('cabinets/:cabinetId/shelves/:shelfId')
  @RequirePermission('shelf-map', 'write')
  @ApiOperation({ summary: 'Delete a shelf and all its items' })
  removeShelf(
    @Param('cabinetId', ParseIntPipe) cabinetId: number,
    @Param('shelfId', ParseIntPipe) shelfId: number,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.removeShelf(cabinetId, shelfId, user.Id);
  }

  // ---- Items ----

  @Get('cabinets/:cabinetId/shelves/:shelfId/items')
  @RequirePermission('shelf-map', 'read')
  @ApiOperation({ summary: 'Get all items in a shelf' })
  findItems(
    @Param('cabinetId', ParseIntPipe) cabinetId: number,
    @Param('shelfId', ParseIntPipe) shelfId: number,
  ) {
    return this.service.findItems(cabinetId, shelfId);
  }

  @Post('cabinets/:cabinetId/shelves/:shelfId/items')
  @RequirePermission('shelf-map', 'write')
  @ApiOperation({ summary: 'Create an item in a shelf' })
  createItem(
    @Param('cabinetId', ParseIntPipe) cabinetId: number,
    @Param('shelfId', ParseIntPipe) shelfId: number,
    @Body() dto: CreateItemDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.createItem(cabinetId, shelfId, dto, user.Id);
  }

  @Put('cabinets/:cabinetId/shelves/:shelfId/items/:itemId')
  @RequirePermission('shelf-map', 'write')
  @ApiOperation({ summary: 'Update an item' })
  updateItem(
    @Param('cabinetId', ParseIntPipe) cabinetId: number,
    @Param('shelfId', ParseIntPipe) shelfId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateItemDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.updateItem(cabinetId, shelfId, itemId, dto, user.Id);
  }

  @Delete('cabinets/:cabinetId/shelves/:shelfId/items/:itemId')
  @RequirePermission('shelf-map', 'write')
  @ApiOperation({ summary: 'Delete an item' })
  removeItem(
    @Param('cabinetId', ParseIntPipe) cabinetId: number,
    @Param('shelfId', ParseIntPipe) shelfId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.removeItem(cabinetId, shelfId, itemId, user.Id);
  }
}
