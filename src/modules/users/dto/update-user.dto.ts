import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// Passwords change only through POST /users/:id/reset-password (reset-password permission)
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['Password'] as const)) {}
