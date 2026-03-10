import { IsNotEmpty, IsString, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateOtherDocumentDto {
  @ApiProperty({ example: 'Office Supplies Receipt' })
  @IsNotEmpty()
  @IsString()
  Title: string;

  @ApiProperty({ example: 'Receipt for office supplies purchased' })
  @IsNotEmpty()
  @IsString()
  Particulars: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  ShelfItemId?: number;
}
