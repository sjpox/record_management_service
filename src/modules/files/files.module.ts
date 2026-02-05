import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FtpService } from '../../common/services/ftp.service';

@Module({
  controllers: [FilesController],
  providers: [FtpService],
})
export class FilesModule {}
