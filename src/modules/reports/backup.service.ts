import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  private readonly s3 = new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
  });

  private readonly bucket = process.env.BACKUP_S3_BUCKET ?? '';
  private readonly prefix = process.env.BACKUP_S3_PREFIX ?? 'database-backups';

  private parseDatabaseUrl(): {
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
  } {
    const url = process.env.DATABASE_URL ?? '';
    const match = url.match(
      /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/,
    );

    if (!match) {
      throw new Error('Invalid DATABASE_URL format');
    }

    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: match[4],
      database: match[5],
    };
  }

  @Cron('0 2,14 * * *', { name: 'database-backup' })
  async handleBackup(): Promise<void> {
    this.logger.log('Starting database backup...');
    const startTime = Date.now();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let tempFile: string | undefined;

    try {
      const db = this.parseDatabaseUrl();
      const filename = `${db.database}-${timestamp}.sql.gz`;
      tempFile = path.join(os.tmpdir(), filename);

      // Run mysqldump piped to gzip
      await new Promise<void>((resolve, reject) => {
        execFile(
          '/bin/sh',
          [
            '-c',
            `mysqldump -h ${db.host} -P ${db.port} -u ${db.user} --single-transaction --routines --triggers "${db.database}" | gzip > "${tempFile}"`,
          ],
          { env: { ...process.env, MYSQL_PWD: db.password } },
          (error, _stdout, stderr) => {
            if (error) {
              reject(new Error(`mysqldump failed: ${stderr || error.message}`));
            } else {
              resolve();
            }
          },
        );
      });

      // Upload to S3
      const dateDir = new Date().toISOString().slice(0, 10);
      const s3Key = `${this.prefix}/${dateDir}/${filename}`;
      const fileBuffer = fs.readFileSync(tempFile);

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: 'application/gzip',
        }),
      );

      const sizeMb = (fileBuffer.length / (1024 * 1024)).toFixed(2);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(
        `Backup uploaded: s3://${this.bucket}/${s3Key} (${sizeMb} MB in ${duration}s)`,
      );
    } catch (error) {
      this.logger.error(
        'Database backup failed',
        error instanceof Error ? error.stack : error,
      );
    } finally {
      // Clean up temp file
      if (tempFile && fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
}
