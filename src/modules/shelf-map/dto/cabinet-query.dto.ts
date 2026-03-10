import { IsOptional, IsString, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CabinetQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by cabinet name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by building ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  buildingId?: number;

  @ApiPropertyOptional({ description: 'Filter by floor ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  floorId?: number;

  @ApiPropertyOptional({ description: 'Filter by room ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  roomId?: number;
}
