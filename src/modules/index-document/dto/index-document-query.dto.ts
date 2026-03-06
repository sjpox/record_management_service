import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class IndexDocumentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by payee or particulars' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by payee' })
  @IsOptional()
  @IsString()
  payee?: string;
}
