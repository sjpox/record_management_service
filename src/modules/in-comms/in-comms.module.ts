import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { InCommsController } from './in-comms.controller';
import { InCommsService } from './in-comms.service';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  controllers: [InCommsController],
  providers: [InCommsService],
  exports: [InCommsService],
})
export class InCommsModule {}
