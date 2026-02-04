import { IsNotEmpty, IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVoucherDto {
  @IsNotEmpty()
  @IsString()
  VoucherNo: string;

  @IsOptional()
  @IsString()
  TrackNo?: string;

  @IsOptional()
  @IsString()
  Payee?: string;

  @IsOptional()
  @IsString()
  Particulars?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  Amount?: number;

  @IsOptional()
  @IsDateString()
  DateReleased?: string;

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
