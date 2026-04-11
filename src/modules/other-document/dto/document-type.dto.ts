import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDocumentTypeDto {
  @ApiProperty({ example: 'Memorandum' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  Type: string;
}

export class UpdateDocumentTypeDto {
  @ApiProperty({ example: 'Special Order' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  Type: string;
}
