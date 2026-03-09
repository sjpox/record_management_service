import { IsNotEmpty, IsString, IsOptional, IsInt, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateLocationDto {
  @ApiProperty({ example: 'Main Office' })
  @IsNotEmpty()
  @IsString()
  Name: string;

  @ApiProperty({ example: 'building', enum: ['building', 'floor', 'room'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['building', 'floor', 'room'])
  Type: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  ParentId?: number;
}
