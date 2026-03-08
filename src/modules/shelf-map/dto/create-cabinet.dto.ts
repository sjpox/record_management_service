import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCabinetDto {
  @ApiProperty({ example: 'Cabinet A' })
  @IsNotEmpty()
  @IsString()
  Name: string;

  @ApiProperty({ example: '#3B82F6' })
  @IsNotEmpty()
  @IsString()
  Color: string;

  @ApiPropertyOptional({ example: 'Main Building' })
  @IsOptional()
  @IsString()
  Building?: string;

  @ApiPropertyOptional({ example: '2nd Floor' })
  @IsOptional()
  @IsString()
  Floor?: string;

  @ApiPropertyOptional({ example: 'Room 201' })
  @IsOptional()
  @IsString()
  Room?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  X?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  Y?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  Width?: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  Height?: number;
}
