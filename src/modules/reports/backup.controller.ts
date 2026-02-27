import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { BackupService } from './backup.service';

@ApiTags('Backup')
@ApiBearerAuth()
@Controller('backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly auditService: AuditService,
  ) {}

  @Post('database')
  @ApiOperation({ summary: 'Trigger database backup manually' })
  async triggerDatabaseBackup(@CurrentUser() user: { Id: number }, @Req() req: Request) {
    await this.backupService.handleBackup();
    this.auditService.log({
      entityType: 'Backup',
      action: 'DATABASE_BACKUP',
      userId: user.Id,
      ipAddress: req.ip,
    });
    return { message: 'Database backup completed' };
  }

  @Post('ftp')
  @ApiOperation({ summary: 'Trigger FTP files backup manually' })
  async triggerFtpBackup(@CurrentUser() user: { Id: number }, @Req() req: Request) {
    await this.backupService.handleFtpBackup();
    this.auditService.log({
      entityType: 'Backup',
      action: 'FTP_BACKUP',
      userId: user.Id,
      ipAddress: req.ip,
    });
    return { message: 'FTP files backup completed' };
  }

  @Post('all')
  @ApiOperation({ summary: 'Trigger both database and FTP backups' })
  async triggerAllBackups(@CurrentUser() user: { Id: number }, @Req() req: Request) {
    await Promise.all([
      this.backupService.handleBackup(),
      this.backupService.handleFtpBackup(),
    ]);
    this.auditService.log({
      entityType: 'Backup',
      action: 'ALL_BACKUP',
      userId: user.Id,
      ipAddress: req.ip,
    });
    return { message: 'All backups completed' };
  }
}
