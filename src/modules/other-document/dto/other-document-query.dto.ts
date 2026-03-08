import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class OtherDocumentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by title or particulars' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by title' })
  @IsOptional()
  @IsString()
  title?: string;
}
