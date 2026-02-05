import { IsOptional, IsBooleanString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class VoucherQueryDto extends PaginationDto {
  @IsOptional()
  @IsBooleanString()
  isArchived?: string;
}
