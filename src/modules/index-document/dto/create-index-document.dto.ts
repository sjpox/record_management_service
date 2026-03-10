import { IsNotEmpty, IsString, IsDateString, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateIndexDocumentDto {
  @ApiProperty({ example: 'Juan Dela Cruz' })
  @IsNotEmpty()
  @IsString()
  Payee: string;

  @ApiProperty({ example: 'Payment for office supplies' })
  @IsNotEmpty()
  @IsString()
  Particulars: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsNotEmpty()
  @IsDateString()
  PeriodStart: string;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  @IsNotEmpty()
  @IsDateString()
  PeriodEnd: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  ShelfItemId?: number;
}
