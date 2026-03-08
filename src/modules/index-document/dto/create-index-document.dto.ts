import { IsNotEmpty, IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIndexDocumentDto {
  @ApiProperty({ example: 'Juan Dela Cruz' })
  @IsNotEmpty()
  @IsString()
  Payee: string;

  @ApiProperty({ example: 'Payment for office supplies' })
  @IsNotEmpty()
  @IsString()
  Particulars: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsNotEmpty()
  @IsDateString()
  PeriodStart: string;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  @IsNotEmpty()
  @IsDateString()
  PeriodEnd: string;
}
