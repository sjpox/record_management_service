import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PermissionsModule } from '../permissions/permissions.module';
import { OtherDocumentController } from './other-document.controller';
import { OtherDocumentService } from './other-document.service';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
    PermissionsModule,
  ],
  controllers: [OtherDocumentController],
  providers: [OtherDocumentService],
  exports: [OtherDocumentService],
})
export class OtherDocumentModule {}
