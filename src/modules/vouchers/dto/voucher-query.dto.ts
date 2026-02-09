import { IsOptional, IsBooleanString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class VoucherQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by archived status', example: 'true' })
  @IsOptional()
  @IsBooleanString()
  isArchived?: string;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by voucher number' })
  @IsOptional()
  @IsString()
  voucherNo?: string;

  @ApiPropertyOptional({ description: 'Filter by transaction number' })
  @IsOptional()
  @IsString()
  transactionNo?: string;

  @ApiPropertyOptional({ description: 'Filter by payee' })
  @IsOptional()
  @IsString()
  payee?: string;

  @ApiPropertyOptional({ description: 'Filter by claim type' })
  @IsOptional()
  @IsString()
  claimType?: string;
}
