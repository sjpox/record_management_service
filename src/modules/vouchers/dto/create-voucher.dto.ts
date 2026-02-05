import { IsNotEmpty, IsString, IsOptional, IsNumber, IsDateString, IsInt, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVoucherDto {
  @IsNotEmpty()
  @IsString()
  VoucherNo: string;

  @IsNotEmpty()
  @IsString()
  TransactionNo: string;

  @IsNotEmpty()
  @IsString()
  Payee: string;

  @IsNotEmpty()
  @IsString()
  Particulars: string;

  @IsOptional()
  @IsString()
  ClaimType?: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  Amount: number;

  @IsNotEmpty()
  @IsDateString()
  DateDisbursed: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  IsArchived?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  AddedById?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  LastModifiedById?: number;
}
