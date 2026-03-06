import { Module } from '@nestjs/common';
import { IndexDocumentController } from './index-document.controller';
import { IndexDocumentService } from './index-document.service';

@Module({
  controllers: [IndexDocumentController],
  providers: [IndexDocumentService],
  exports: [IndexDocumentService],
})
export class IndexDocumentModule {}
