import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class UpdateThreadDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['open', 'in-progress', 'resolved'])
  status?: string;
}
