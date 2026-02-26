import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['Password'] as const)) {
  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain a lowercase letter' })
  @Matches(/\d/, { message: 'Password must contain a number' })
  @Matches(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, { message: 'Password must contain a special character' })
  Password?: string;
}
