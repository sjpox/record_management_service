import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

@Module({
  imports: [PermissionsModule],
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
