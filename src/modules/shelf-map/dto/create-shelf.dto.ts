import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShelfDto {
  @ApiProperty({ example: 'Shelf 1' })
  @IsNotEmpty()
  @IsString()
  Name: string;

  @ApiPropertyOptional({ example: 'Top section' })
  @IsOptional()
  @IsString()
  Location?: string;
}
