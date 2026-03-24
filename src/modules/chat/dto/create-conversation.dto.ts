import { IsInt, IsNotEmpty, IsOptional, IsString, IsArray, ArrayMinSize, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ description: 'ID of the user to start a 1-to-1 conversation with (for DM)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  participantId?: number;

  @ApiPropertyOptional({ description: 'Array of user IDs for a group conversation' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @Type(() => Number)
  @IsInt({ each: true })
  participantIds?: number[];

  @ApiPropertyOptional({ description: 'Group name (required for group chats)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;
}
