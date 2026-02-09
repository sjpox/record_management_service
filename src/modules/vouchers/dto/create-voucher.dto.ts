import { IsNotEmpty, IsString, IsOptional, IsNumber, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVoucherDto {
  @ApiProperty({ example: 'V-2024-001' })
  @IsNotEmpty()
  @IsString()
  VoucherNo: string;

  @ApiProperty({ example: 'TXN-2024-001' })
  @IsNotEmpty()
  @IsString()
  TransactionNo: string;

  @ApiProperty({ example: 'Juan Dela Cruz' })
  @IsNotEmpty()
  @IsString()
  Payee: string;

  @ApiProperty({ example: 'Office supplies reimbursement' })
  @IsNotEmpty()
  @IsString()
  Particulars: string;

  @ApiPropertyOptional({ example: 'Reimbursement' })
  @IsOptional()
  @IsString()
  ClaimType?: string;

  @ApiProperty({ example: 1500.0 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  Amount: number;

  @ApiProperty({ example: '2024-01-15' })
  @IsNotEmpty()
  @IsDateString()
  DateDisbursed: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  IsArchived?: boolean;
}
