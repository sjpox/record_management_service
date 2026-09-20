import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateThreadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  subject: string;

  @IsOptional()
  @IsString()
  description?: string;
}
