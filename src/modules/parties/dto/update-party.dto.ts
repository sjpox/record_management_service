import { IsString, IsOptional, IsIn, IsBoolean, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePartyDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

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

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
