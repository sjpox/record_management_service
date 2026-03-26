import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommsController } from './comms.controller';
import { CommsService } from './comms.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CommsController],
  providers: [CommsService],
  exports: [CommsService],
})
export class CommsModule {}
