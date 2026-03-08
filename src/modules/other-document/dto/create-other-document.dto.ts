import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOtherDocumentDto {
  @ApiProperty({ example: 'Office Supplies Receipt' })
  @IsNotEmpty()
  @IsString()
  Title: string;

  @ApiProperty({ example: 'Receipt for office supplies purchased' })
  @IsNotEmpty()
  @IsString()
  Particulars: string;
}
