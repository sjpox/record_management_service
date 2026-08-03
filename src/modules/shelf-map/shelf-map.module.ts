import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { ShelfMapController } from './shelf-map.controller';
import { ShelfMapService } from './shelf-map.service';

@Module({
  imports: [PermissionsModule],
  controllers: [ShelfMapController],
  providers: [ShelfMapService],
  exports: [ShelfMapService],
})
export class ShelfMapModule {}
