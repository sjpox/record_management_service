import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportsService } from './reports.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ReportsService],
})
export class ReportsModule {}
