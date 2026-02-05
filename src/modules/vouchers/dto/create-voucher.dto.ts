import { IsNotEmpty, IsString, IsOptional, IsNumber, IsDateString, IsInt } from 'class-validator';
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
  @IsString()
  ArchivingArea?: string;

  @IsOptional()
  @IsString()
  RackNo?: string;

  @IsOptional()
  @IsString()
  Folder?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  AddedById?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  LastModifiedById?: number;
}
