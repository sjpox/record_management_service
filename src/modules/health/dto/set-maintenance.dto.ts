import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SetMaintenanceDto {
  @ApiProperty({ example: true })
  @Type(() => Boolean)
  @IsBoolean()
  active: boolean;

  @ApiPropertyOptional({ example: 'System upgrade in progress.' })
  @IsOptional()
  @IsString()
  message?: string;
}
