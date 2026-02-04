import { Module } from '@nestjs/common';
import { StockRoomsController } from './stock-rooms.controller';
import { StockRoomsService } from './stock-rooms.service';

@Module({
  controllers: [StockRoomsController],
  providers: [StockRoomsService],
  exports: [StockRoomsService],
})
export class StockRoomsModule {}
