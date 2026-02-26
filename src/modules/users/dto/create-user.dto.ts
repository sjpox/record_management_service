import { IsNotEmpty, IsString, MinLength, IsOptional, IsBoolean, Matches, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  FirstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty()
  @IsString()
  LastName: string;

  @ApiProperty({ example: 'EMP001' })
  @IsNotEmpty()
  @IsString()
  EmployeeId: string;

  @ApiProperty({ example: 'P@ssw0rd!', minLength: 8 })
  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain a lowercase letter' })
  @Matches(/\d/, { message: 'Password must contain a number' })
  @Matches(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, { message: 'Password must contain a special character' })
  Password: string;

  @ApiPropertyOptional({ example: 'IT' })
  @IsOptional()
  @IsString()
  Section?: string;

  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  Role?: string;

  @ApiPropertyOptional({ example: '+639171234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\+639\d{9}$/, { message: 'Mobile number must be in +63 format (e.g. +639171234567)' })
  MobileNo?: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  Email?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  IsActive?: boolean;
}
