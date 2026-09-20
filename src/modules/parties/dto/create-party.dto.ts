import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePartyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(100)
  shortName?: string;

  @ApiPropertyOptional({ enum: ['organization', 'office', 'individual', 'government', 'private'] })
  @IsString()
  @IsOptional()
  @IsIn(['organization', 'office', 'individual', 'government', 'private'])
  type?: string;
}
