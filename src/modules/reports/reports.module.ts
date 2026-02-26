import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportsService } from './reports.service';
import { BackupService } from './backup.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ReportsService, BackupService],
})
export class ReportsModule {}
