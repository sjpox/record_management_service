import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDocOriginDto {
  @IsNotEmpty()
  @IsString()
  Origin: string;
}
