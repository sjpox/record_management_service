import { IsOptional, IsArray, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CropArea } from './compose-pdf.dto';

export class UpdatePhotosDto {
  @ApiPropertyOptional({ type: [Number], description: 'IDs of photos to delete' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  deletePhotoIds?: number[];

  @ApiPropertyOptional({ type: [CropArea], description: 'Crop areas to apply and replace original images' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CropArea)
  crops?: CropArea[];
}
