import { IsNotEmpty, IsString } from 'class-validator';

export class CreateStockRoomDto {
  @IsNotEmpty()
  @IsString()
  RoomName: string;
}
