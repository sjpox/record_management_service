import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PermissionsModule } from '../permissions/permissions.module';
import { ReportsService } from './reports.service';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';

@Module({
  imports: [ScheduleModule.forRoot(), PermissionsModule],
  controllers: [BackupController],
  providers: [ReportsService, BackupService],
})
export class ReportsModule {}
