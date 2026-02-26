import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackupService } from './backup.service';

@ApiTags('Backup')
@ApiBearerAuth()
@Controller('backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('database')
  @ApiOperation({ summary: 'Trigger database backup manually' })
  async triggerDatabaseBackup() {
    await this.backupService.handleBackup();
    return { message: 'Database backup completed' };
  }

  @Post('ftp')
  @ApiOperation({ summary: 'Trigger FTP files backup manually' })
  async triggerFtpBackup() {
    await this.backupService.handleFtpBackup();
    return { message: 'FTP files backup completed' };
  }

  @Post('all')
  @ApiOperation({ summary: 'Trigger both database and FTP backups' })
  async triggerAllBackups() {
    await Promise.all([
      this.backupService.handleBackup(),
      this.backupService.handleFtpBackup(),
    ]);
    return { message: 'All backups completed' };
  }
}
