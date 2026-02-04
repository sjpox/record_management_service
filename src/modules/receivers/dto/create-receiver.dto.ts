import { IsNotEmpty, IsString } from 'class-validator';

export class CreateReceiverDto {
  @IsNotEmpty()
  @IsString()
  Department: string;
}
