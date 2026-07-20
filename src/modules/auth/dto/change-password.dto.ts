import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain a lowercase letter' })
  @Matches(/\d/, { message: 'Password must contain a number' })
  @Matches(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, { message: 'Password must contain a special character' })
  newPassword: string;
}
