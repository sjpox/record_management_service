import { IsOptional, IsArray, ValidateNested, IsNumber, IsBoolean, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CropArea {
  @IsNumber()
  imageId: number;

  @IsNumber()
  left: number;

  @IsNumber()
  top: number;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsOptional()
  @IsNumber()
  rotate?: number;
}

export class OverrideImage {
  @IsNumber()
  imageId: number;

  @IsString()
  base64: string;
}

export class ComposePdfDto {
  @IsArray()
  @IsNumber({}, { each: true })
  imageIds: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CropArea)
  crops?: CropArea[];

  @IsOptional()
  @IsBoolean()
  watermark?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OverrideImage)
  overrideImages?: OverrideImage[];
}
