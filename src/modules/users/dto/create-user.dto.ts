import { IsNotEmpty, IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  FirstName: string;

  @IsNotEmpty()
  @IsString()
  LastName: string;

  @IsNotEmpty()
  @IsString()
  EmployeeId: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  Password: string;

  @IsOptional()
  @IsString()
  Section?: string;

  @IsOptional()
  @IsString()
  Role?: string;

  @IsNotEmpty()
  @IsString()
  MobileNo: string;

  @IsNotEmpty()
  @IsString()
  Email: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  IsActive?: boolean;
}
