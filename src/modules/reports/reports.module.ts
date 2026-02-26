import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportsService } from './reports.service';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [BackupController],
  providers: [ReportsService, BackupService],
})
export class ReportsModule {}
