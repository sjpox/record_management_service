import { IsOptional, IsBooleanString, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class VoucherQueryDto extends PaginationDto {
  @IsOptional()
  @IsBooleanString()
  isArchived?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  voucherNo?: string;

  @IsOptional()
  @IsString()
  transactionNo?: string;

  @IsOptional()
  @IsString()
  payee?: string;

  @IsOptional()
  @IsString()
  claimType?: string;
}
