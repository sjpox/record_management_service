import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInCommDto {
  @IsOptional()
  @IsString()
  DateReceived?: string;

  @IsOptional()
  @IsString()
  DatePrepared?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  DocOrigin_Id?: number;

  @IsOptional()
  @IsString()
  DocType?: string;

  @IsOptional()
  @IsString()
  Particulars?: string;

  @IsOptional()
  @IsString()
  RoutedToPA?: string;

  @IsOptional()
  @IsString()
  dtToPA?: string;

  @IsOptional()
  @IsString()
  Rerouted?: string;

  @IsOptional()
  @IsString()
  dtRerouted?: string;

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
}
