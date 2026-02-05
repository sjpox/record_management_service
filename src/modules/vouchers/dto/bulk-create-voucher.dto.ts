import { Type } from 'class-transformer';
import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { CreateVoucherDto } from './create-voucher.dto';

export class BulkCreateVoucherDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateVoucherDto)
  vouchers: CreateVoucherDto[];
}
