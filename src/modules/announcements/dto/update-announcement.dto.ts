import { IsString, IsNotEmpty, MaxLength, IsOptional, IsDateString, IsIn, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAnnouncementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['general', 'maintenance', 'policy', 'event', 'urgent'])
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['low', 'normal', 'high', 'critical'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['draft', 'published', 'archived'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDismissible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
