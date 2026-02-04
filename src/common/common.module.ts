import { Global, Module } from '@nestjs/common';
import { FtpService } from './services/ftp.service';

@Global()
@Module({
  providers: [FtpService],
  exports: [FtpService],
})
export class CommonModule {}
