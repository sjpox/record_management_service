import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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
  private readonly minFreeBytes = Number(process.env.BACKUP_MIN_FREE_MB) * 1024 * 1024 || 1024 * 1024 * 1024; // 1 GB default

  /**
   * Ensures the target drive has enough free space for a backup of the given size
   * (with headroom), throwing before any partial copy is attempted.
   */
  private assertDiskSpace(requiredBytes: number, targetDir: string): void {
    const stats = fs.statfsSync(targetDir);
    const freeBytes = stats.bavail * stats.bsize;
    const requiredWithHeadroom = requiredBytes * 1.2;

    if (freeBytes < Math.max(requiredWithHeadroom, this.minFreeBytes)) {
      throw new Error(
        `Not enough disk space at ${targetDir}: ${(freeBytes / (1024 * 1024)).toFixed(0)} MB free, ` +
          `need ~${(requiredWithHeadroom / (1024 * 1024)).toFixed(0)} MB`,
      );
    }
  }

  private saveToLocal(filePath: string, subDir: string): string {
    const filename = path.basename(filePath);
    const localDir = this.ensureLocalDir(subDir);

    const fileSize = fs.statSync(filePath).size;
    this.assertDiskSpace(fileSize, this.localBackupDir);

    const localPath = path.join(localDir, filename);
    fs.copyFileSync(filePath, localPath);
    return localPath;
  }

  /**
   * Resolves (and creates) today's dated backup folder under subDir.
   */
  private ensureLocalDir(subDir: string): string {
    const dateDir = new Date().toISOString().slice(0, 10);
    const localDir = path.join(this.localBackupDir, subDir, dateDir);

    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    return localDir;
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

      // Save to local backup directory
      const localPath = this.saveToLocal(tempFile, 'database-backups');

      const fileSize = fs.statSync(tempFile).size;
      const sizeMb = (fileSize / (1024 * 1024)).toFixed(2);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(
        `Database backup saved: ${localPath} (${sizeMb} MB in ${duration}s)`,
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
    this.logger.log('Starting FTP files backup...');
    const startTime = Date.now();
    let fileCount = 0;
    let errorCount = 0;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipFilename = `ftp-backup-${timestamp}.zip`;
    const localDir = this.ensureLocalDir('ftp-backups');
    const zipPath = path.join(localDir, zipFilename);

    const client = new FtpClient();
    client.ftp.verbose = false;

    try {
      await client.access(this.ftpConfig);

      const filePaths = await this.listFtpFilesRecursive(client, this.ftpBaseDir);
      this.logger.log(`Found ${filePaths.length} files on FTP to back up`);

      // Rough pre-check: zipping shrinks most files, so raw total size is a safe upper bound
      const totalSourceBytes = filePaths.reduce((sum, f) => sum + f.size, 0);
      this.assertDiskSpace(totalSourceBytes, this.localBackupDir);

      // Stream the zip archive directly to the local backup directory
      const output = fs.createWriteStream(zipPath);
      const archive = archiver.create('zip', { zlib: { level: 6 } });

      const archiveReady = new Promise<void>((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', reject);
      });

      archive.pipe(output);

      for (const { path: filePath } of filePaths) {
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

      const zipSize = fs.statSync(zipPath).size;
      const sizeMb = (zipSize / (1024 * 1024)).toFixed(2);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(
        `FTP backup saved: ${zipPath} (${fileCount} files, ${sizeMb} MB, ${errorCount} errors, ${duration}s)`,
      );
    } catch (error) {
      this.logger.error(
        'FTP files backup failed',
        error instanceof Error ? error.stack : error,
      );
      // Remove a partial/failed archive so it isn't mistaken for a valid backup
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
    } finally {
      client.close();
    }
  }

  private async listFtpFilesRecursive(client: FtpClient, dir: string): Promise<{ path: string; size: number }[]> {
    const files: { path: string; size: number }[] = [];
    const items = await client.list(dir);

    for (const item of items) {
      const fullPath = path.posix.join(dir, item.name);
      if (item.isDirectory) {
        const subFiles = await this.listFtpFilesRecursive(client, fullPath);
        files.push(...subFiles);
      } else {
        files.push({ path: fullPath, size: item.size });
      }
    }

    return files;
  }
}
