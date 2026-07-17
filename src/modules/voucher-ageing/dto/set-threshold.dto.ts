import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SetThresholdDto {
  @ApiProperty({ example: 30, description: 'Number of days before a pending voucher is considered aged' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ThresholdDays: number;
}
