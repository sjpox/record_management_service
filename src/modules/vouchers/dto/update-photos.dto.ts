import { IsOptional, IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePhotosDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  deletePhotoIds?: number[];
}
