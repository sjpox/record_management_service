import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Client as FtpClient } from 'basic-ftp';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as zlib from 'zlib';
import { Writable } from 'stream';
import * as archiver from 'archiver';

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
  private readonly dbBackupPrefix = process.env.BACKUP_S3_PREFIX ?? 'database-backups';
  private readonly ftpBackupPrefix = process.env.BACKUP_S3_FTP_PREFIX ?? 'ftp-backups';

  private readonly ftpConfig = {
    host: process.env.FTP_HOST ?? '127.0.0.1',
    port: Number(process.env.FTP_PORT) || 21,
    user: decodeURIComponent(process.env.FTP_USER ?? 'root'),
    password: decodeURIComponent(process.env.FTP_PASSWORD ?? ''),
    secure: false,
    secureOptions: { rejectUnauthorized: false },
  };

  private readonly ftpBaseDir = process.env.FTP_UPLOAD_DIR ?? '/ftp';
  private readonly mysqldumpPath = process.env.MYSQLDUMP_PATH ?? 'mysqldump';
  private readonly localBackupDir = process.env.BACKUP_LOCAL_DIR ?? path.join(process.cwd(), 'backups');

  private async uploadToS3OrLocal(
    filePath: string,
    s3Key: string,
    contentType: string,
  ): Promise<{ destination: 's3' | 'local'; location: string }> {
    const fileBuffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: contentType,
        }),
      );
      return { destination: 's3', location: `s3://${this.bucket}/${s3Key}` };
    } catch (s3Error) {
      this.logger.warn(
        `S3 upload failed, saving locally`,
        s3Error instanceof Error ? s3Error.stack : s3Error,
      );

      const localDir = path.join(this.localBackupDir, path.dirname(s3Key));
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      const localPath = path.join(localDir, filename);
      fs.copyFileSync(filePath, localPath);
      return { destination: 'local', location: localPath };
    }
  }

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
      user: decodeURIComponent(match[1]),
      password: decodeURIComponent(match[2]),
      host: match[3],
      port: match[4],
      database: match[5],
    };
  }

  @Cron('30 12,17 * * *', { name: 'database-backup' })
  async handleBackup(): Promise<void> {
    this.logger.log('Starting database backup...');
    const startTime = Date.now();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let tempFile: string | undefined;

    try {
      const db = this.parseDatabaseUrl();
      const sqlFilename = `${db.database}-${timestamp}.sql`;
      const sqlPath = path.join(os.tmpdir(), sqlFilename);
      const filename = `${sqlFilename}.gz`;
      tempFile = path.join(os.tmpdir(), filename);

      // Run mysqldump (cross-platform)
      const dumpCmd = `"${this.mysqldumpPath}" -h ${db.host} -P ${db.port} -u ${db.user} --single-transaction --routines --triggers "${db.database}"`;
      await new Promise<void>((resolve, reject) => {
        exec(
          `${dumpCmd} > "${sqlPath}"`,
          { env: { ...process.env, MYSQL_PWD: db.password } },
          (error: Error | null, _stdout: string, stderr: string) => {
            if (error) {
              reject(new Error(`mysqldump failed: ${stderr || error.message}`));
            } else {
              resolve();
            }
          },
        );
      });

      // Gzip using Node.js zlib (cross-platform)
      const sqlBuffer = fs.readFileSync(sqlPath);
      const gzipped = zlib.gzipSync(sqlBuffer);
      fs.writeFileSync(tempFile, gzipped);
      fs.unlinkSync(sqlPath);

      // Upload to S3, fallback to local
      const dateDir = new Date().toISOString().slice(0, 10);
      const s3Key = `${this.dbBackupPrefix}/${dateDir}/${filename}`;
      const result = await this.uploadToS3OrLocal(tempFile, s3Key, 'application/gzip');

      const fileSize = fs.statSync(tempFile).size;
      const sizeMb = (fileSize / (1024 * 1024)).toFixed(2);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(
        `Database backup saved (${result.destination}): ${result.location} (${sizeMb} MB in ${duration}s)`,
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

  @Cron('30 12,17 * * *', { name: 'ftp-files-backup' })
  async handleFtpBackup(): Promise<void> {
    this.logger.log('Starting FTP files backup to S3...');
    const startTime = Date.now();
    let fileCount = 0;
    let errorCount = 0;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipFilename = `ftp-backup-${timestamp}.zip`;
    const zipPath = path.join(os.tmpdir(), zipFilename);

    const client = new FtpClient();
    client.ftp.verbose = false;

    try {
      await client.access(this.ftpConfig);

      const filePaths = await this.listFtpFilesRecursive(client, this.ftpBaseDir);
      this.logger.log(`Found ${filePaths.length} files on FTP to back up`);

      // Create zip archive
      const output = fs.createWriteStream(zipPath);
      const archive = archiver.create('zip', { zlib: { level: 6 } });

      const archiveReady = new Promise<void>((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', reject);
      });

      archive.pipe(output);

      for (const filePath of filePaths) {
        try {
          const chunks: Buffer[] = [];
          const writable = new Writable({
            write(chunk, _encoding, callback) {
              chunks.push(chunk);
              callback();
            },
          });
          await client.downloadTo(writable, filePath);
          const fileBuffer = Buffer.concat(chunks);

          // Add to zip, preserving directory structure relative to base dir
          const relativePath = filePath.startsWith(this.ftpBaseDir)
            ? filePath.slice(this.ftpBaseDir.length + 1)
            : filePath;
          archive.append(fileBuffer, { name: relativePath });

          fileCount++;
        } catch (err) {
          errorCount++;
          this.logger.warn(
            `Failed to download ${filePath}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      await archive.finalize();
      await archiveReady;

      // Upload zip to S3, fallback to local
      const dateDir = new Date().toISOString().slice(0, 10);
      const s3Key = `${this.ftpBackupPrefix}/${dateDir}/${zipFilename}`;
      const result = await this.uploadToS3OrLocal(zipPath, s3Key, 'application/zip');

      const zipSize = fs.statSync(zipPath).size;
      const sizeMb = (zipSize / (1024 * 1024)).toFixed(2);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(
        `FTP backup saved (${result.destination}): ${result.location} (${fileCount} files, ${sizeMb} MB, ${errorCount} errors, ${duration}s)`,
      );
    } catch (error) {
      this.logger.error(
        'FTP files backup failed',
        error instanceof Error ? error.stack : error,
      );
    } finally {
      client.close();
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
    }
  }

  private async listFtpFilesRecursive(client: FtpClient, dir: string): Promise<string[]> {
    const files: string[] = [];
    const items = await client.list(dir);

    for (const item of items) {
      const fullPath = path.posix.join(dir, item.name);
      if (item.isDirectory) {
        const subFiles = await this.listFtpFilesRecursive(client, fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }
}
