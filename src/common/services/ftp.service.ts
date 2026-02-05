import { Injectable } from '@nestjs/common';
import { Client } from 'basic-ftp';
import * as path from 'path';
import { Readable } from 'stream';
import sharp from 'sharp';

export interface UploadResult {
  success: boolean;
  filePath: string;
  error?: string;
}

export interface VoucherUploadOptions {
  voucherNo: string;
  date?: Date;
}

interface ProcessedFile {
  buffer: Buffer;
  filename: string;
}

@Injectable()
export class FtpService {
  private readonly ftpConfig = {
    host: process.env.FTP_HOST ?? '127.0.0.1',
    port: Number(process.env.FTP_PORT) || 21,
    user: process.env.FTP_USER ?? 'root',
    password: process.env.FTP_PASSWORD ?? '',
    secure: false,
    secureOptions: {
      rejectUnauthorized: false,
    },
  };

  private readonly baseUploadDir = process.env.FTP_UPLOAD_DIR ?? '/ftp';
  private readonly imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];

  private isImage(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return this.imageExtensions.includes(ext);
  }

  private async convertToWebp(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer).webp({ quality: 100 }).toBuffer();
  }

  private getWebpFilename(filename: string): string {
    const ext = path.extname(filename);
    return filename.replace(ext, '.webp');
  }

  /**
   * Process file: convert to WebP if image
   */
  private async processFile(file: Express.Multer.File): Promise<ProcessedFile> {
    let buffer = file.buffer;
    let filename = file.originalname;

    if (this.isImage(filename)) {
      try {
        buffer = await this.convertToWebp(file.buffer);
        filename = this.getWebpFilename(filename);
      } catch (err) {
        console.error('Image conversion error:', err);
      }
    }

    return { buffer, filename };
  }

  buildVoucherPath(category: string, options: VoucherUploadOptions): string {
    const date = new Date();
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const voucherNo = options.voucherNo.replace(/[^a-zA-Z0-9-_]/g, '_');

    return path.posix.join(this.baseUploadDir, category, year, month, voucherNo);
  }

  async uploadVoucherFile(
    file: Express.Multer.File,
    category: string,
    options: VoucherUploadOptions,
  ): Promise<UploadResult> {
    const remotePath = this.buildVoucherPath(category, options);
    const client = new Client();
    client.ftp.verbose = process.env.NODE_ENV !== 'production';

    try {
      // Process file (convert to WebP if needed)
      const processed = await this.processFile(file);
      const fullFilePath = path.posix.join(remotePath, processed.filename);

      await client.access(this.ftpConfig);
      await client.ensureDir(remotePath);
      await client.uploadFrom(Readable.from([processed.buffer]), fullFilePath);

      return { success: true, filePath: fullFilePath };
    } catch (err) {
      console.error('FTP upload error:', err);
      return {
        success: false,
        filePath: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    } finally {
      client.close();
    }
  }

  async uploadMultipleVoucherFiles(
    files: Express.Multer.File[],
    category: string,
    options: VoucherUploadOptions,
  ): Promise<UploadResult[]> {
    if (files.length === 0) return [];

    const remotePath = this.buildVoucherPath(category, options);

    // Process all files in parallel (WebP conversion)
    const processedFiles = await Promise.all(files.map((file) => this.processFile(file)));

    // Single FTP connection for all uploads
    const client = new Client();
    client.ftp.verbose = process.env.NODE_ENV !== 'production';
    const results: UploadResult[] = [];

    try {
      await client.access(this.ftpConfig);
      await client.ensureDir(remotePath);

      // Upload all files using the same connection
      for (const processed of processedFiles) {
        const fullFilePath = path.posix.join(remotePath, processed.filename);
        try {
          await client.uploadFrom(Readable.from([processed.buffer]), fullFilePath);
          results.push({ success: true, filePath: fullFilePath });
        } catch (err) {
          console.error('FTP upload error:', err);
          results.push({
            success: false,
            filePath: '',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      return results;
    } catch (err) {
      console.error('FTP connection error:', err);
      // Return failure for all files if connection failed
      return processedFiles.map(() => ({
        success: false,
        filePath: '',
        error: err instanceof Error ? err.message : 'Connection error',
      }));
    } finally {
      client.close();
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    const client = new Client();
    client.ftp.verbose = process.env.NODE_ENV !== 'production';

    try {
      await client.access(this.ftpConfig);
      await client.remove(filePath);
      return true;
    } catch (err) {
      console.error('FTP delete error:', err);
      return false;
    } finally {
      client.close();
    }
  }

  async deleteMultipleFiles(filePaths: string[]): Promise<boolean[]> {
    if (filePaths.length === 0) return [];

    const client = new Client();
    client.ftp.verbose = process.env.NODE_ENV !== 'production';
    const results: boolean[] = [];

    try {
      await client.access(this.ftpConfig);

      for (const filePath of filePaths) {
        try {
          await client.remove(filePath);
          results.push(true);
        } catch {
          results.push(false);
        }
      }

      return results;
    } catch (err) {
      console.error('FTP connection error:', err);
      return filePaths.map(() => false);
    } finally {
      client.close();
    }
  }
}
