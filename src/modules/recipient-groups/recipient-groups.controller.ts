import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RecipientGroupsService } from './recipient-groups.service';
import { CreateRecipientGroupDto } from './dto/create-recipient-group.dto';
import { UpdateRecipientGroupDto } from './dto/update-recipient-group.dto';

@ApiTags('Recipient Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recipient-groups')
export class RecipientGroupsController {
  constructor(private readonly service: RecipientGroupsService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      search,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateRecipientGroupDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.create(dto, user.Id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecipientGroupDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.update(id, dto, user.Id);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.remove(id, user.Id);
  }
}
