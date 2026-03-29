import { IsString, IsNotEmpty, IsOptional, IsArray, IsIn, IsInt, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AssigneeDto {
  @ApiPropertyOptional({ description: 'User ID if assignee exists in the system' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  userId?: number;

  @ApiPropertyOptional({ description: 'Name if assignee is not a system user' })
  @IsOptional()
  @IsString()
  name?: string;
}

class ActionDto {
  @IsString()
  @IsNotEmpty()
  actionRequired: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssigneeDto)
  assignees?: AssigneeDto[];
}

export class CreateCommDto {
  @ApiProperty()
  @IsString()
  @IsIn(['incoming', 'outgoing'])
  type: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  subject: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sender: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  recipient: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateReceived?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateSent?: string;

  // Validation: incoming requires dateReceived, outgoing requires dateSent — enforced in service

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['low', 'normal', 'urgent'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions?: ActionDto[];
}
