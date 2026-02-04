import { Module } from '@nestjs/common';
import { ReceiversController } from './receivers.controller';
import { ReceiversService } from './receivers.service';

@Module({
  controllers: [ReceiversController],
  providers: [ReceiversService],
  exports: [ReceiversService],
})
export class ReceiversModule {}
