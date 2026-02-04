import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOutGoingDto {
  @IsOptional()
  @IsString()
  DatePrepared?: string;

  @IsOptional()
  @IsString()
  DocType?: string;

  @IsOptional()
  @IsString()
  Particulars?: string;

  @IsOptional()
  @IsString()
  ReceivedBy?: string;

  @IsOptional()
  @IsString()
  DateTrans?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ResponPerson_Id?: number;

  @IsOptional()
  @IsString()
  ActionNeeded?: string;

  @IsOptional()
  @IsString()
  ActionTime?: string;

  @IsOptional()
  @IsString()
  dtFilling?: string;

  @IsOptional()
  @IsString()
  FilingArea?: string;

  @IsOptional()
  @IsString()
  Folder?: string;

  @IsOptional()
  @IsString()
  DocStatus?: string;

  @IsOptional()
  @IsString()
  EncodedBy?: string;
}
