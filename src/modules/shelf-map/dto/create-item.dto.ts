import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateItemDto {
  @ApiProperty({ example: 'File Folder #001' })
  @IsNotEmpty()
  @IsString()
  Label: string;

  @ApiPropertyOptional({ example: 'Contains 2024 Q1 reports' })
  @IsOptional()
  @IsString()
  Description?: string;

  @ApiProperty({ example: 'Records' })
  @IsNotEmpty()
  @IsString()
  Category: string;
}
