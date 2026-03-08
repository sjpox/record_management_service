import { IsOptional, IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOtherDocumentPhotosDto {
  @ApiPropertyOptional({ type: [Number], description: 'IDs of photos to delete' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  deletePhotoIds?: number[];
}
