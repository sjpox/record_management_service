import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OutGoingsController } from './out-goings.controller';
import { OutGoingsService } from './out-goings.service';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  controllers: [OutGoingsController],
  providers: [OutGoingsService],
  exports: [OutGoingsService],
})
export class OutGoingsModule {}
