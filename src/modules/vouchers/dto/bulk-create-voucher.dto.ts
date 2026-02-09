import { Type } from 'class-transformer';
import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateVoucherDto } from './create-voucher.dto';

export class BulkCreateVoucherDto {
  @ApiProperty({ type: [CreateVoucherDto], minItems: 1 })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateVoucherDto)
  vouchers: CreateVoucherDto[];
}
