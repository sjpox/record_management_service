import { IsString, IsNotEmpty, MaxLength, IsOptional, IsDateString, IsIn, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAnnouncementDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;

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
  @IsIn(['draft', 'published'])
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
