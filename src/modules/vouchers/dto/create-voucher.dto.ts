import { IsNotEmpty, IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
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

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  Amount: number;

  @IsNotEmpty()
  @IsDateString()
  DateDisbursed: string;

  @IsOptional()
  @IsString()
  Folder?: string;

  @IsOptional()
  @IsString()
  RoomNo?: string;

  @IsOptional()
  @IsString()
  DocTag?: string;
}
