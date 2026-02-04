import { IsNotEmpty, IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateResponPersonDto {
  @IsNotEmpty()
  @IsString()
  Name: string;

  @IsOptional()
  @IsString()
  ContactNo?: string;

  @IsOptional()
  @IsString()
  IP_Add?: string;

  @IsOptional()
  @IsEmail()
  Email?: string;

  @IsOptional()
  @IsString()
  Department?: string;
}
