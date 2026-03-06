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
import { IndexDocumentService } from './index-document.service';
import { CreateIndexDocumentDto } from './dto/create-index-document.dto';
import { UpdateIndexDocumentDto } from './dto/update-index-document.dto';
import { IndexDocumentQueryDto } from './dto/index-document-query.dto';
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

  @Post()
  @ApiOperation({ summary: 'Create a new index document' })
  create(
    @Body() dto: CreateIndexDocumentDto,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.create(dto, user.Id);
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

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an index document' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { Id: number },
  ) {
    return this.service.remove(id, user.Id);
  }
}
