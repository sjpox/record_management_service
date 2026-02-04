import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDocTypeDto {
  @IsNotEmpty()
  @IsString()
  Type: string;
}
