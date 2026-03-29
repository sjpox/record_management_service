import { IsString, IsOptional, IsIn, IsArray, IsInt, ValidateNested, MaxLength, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class AssigneeDto {
  @ApiPropertyOptional({ description: 'Existing assignee ID (omit for new)' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id?: number;

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
  @ApiPropertyOptional({ description: 'Existing action ID (omit for new)' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id?: number;

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

export class UpdateCommDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['incoming', 'outgoing'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipient?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateReceived?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateSent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['low', 'normal', 'urgent'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'in-progress', 'completed', 'overdue'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions?: ActionDto[];

}
