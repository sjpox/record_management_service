import { PartialType } from '@nestjs/mapped-types';
import { CreateStockRoomDto } from './create-stock-room.dto';

export class UpdateStockRoomDto extends PartialType(CreateStockRoomDto) {}
