import { Module } from '@nestjs/common';
import { ShelfMapController } from './shelf-map.controller';
import { ShelfMapService } from './shelf-map.service';

@Module({
  controllers: [ShelfMapController],
  providers: [ShelfMapService],
  exports: [ShelfMapService],
})
export class ShelfMapModule {}
