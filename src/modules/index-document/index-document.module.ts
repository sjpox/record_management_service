import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IndexDocumentController } from './index-document.controller';
import { IndexDocumentService } from './index-document.service';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  controllers: [IndexDocumentController],
  providers: [IndexDocumentService],
  exports: [IndexDocumentService],
})
export class IndexDocumentModule {}
