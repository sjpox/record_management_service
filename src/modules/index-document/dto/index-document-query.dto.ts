import { IsOptional, IsString, IsDateString } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Filter by period start (from)', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by period end (to)', example: '2026-03-31' })
  @IsOptional()
  @IsDateString()
  periodTo?: string;
}
