import { Injectable } from '@nestjs/common';
import { Client } from 'basic-ftp';
import * as path from 'path';
import { Readable } from 'stream';

export interface UploadResult {
  success: boolean;
  filePath: string;
  error?: string;
}

@Injectable()
export class FtpService {
  private readonly ftpConfig = {
    host: process.env.FTP_HOST ?? '127.0.0.1',
    port: Number(process.env.FTP_PORT) || 21,
    user: process.env.FTP_USER ?? 'root',
    password: process.env.FTP_PASSWORD ?? '',
    secure: true,
    secureOptions: {
      rejectUnauthorized: false,
    },
  };

  private readonly baseUploadDir = process.env.FTP_UPLOAD_DIR ?? '/ftp';

  async uploadFile(
    file: Express.Multer.File,
    subDirectory: string,
  ): Promise<UploadResult> {
    const client = new Client();
    client.ftp.verbose = process.env.NODE_ENV !== 'production';

    const remotePath = path.posix.join(this.baseUploadDir, subDirectory);
    const fullFilePath = path.posix.join(remotePath, file.originalname);

    try {
      await client.access(this.ftpConfig);
      await client.ensureDir(remotePath);
      await client.uploadFrom(Readable.from([file.buffer]), fullFilePath);
      await client.send('QUIT');

      return {
        success: true,
        filePath: fullFilePath,
      };
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

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    subDirectory: string,
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (const file of files) {
      const result = await this.uploadFile(file, subDirectory);
      results.push(result);
    }

    return results;
  }

  async deleteFile(filePath: string): Promise<boolean> {
    const client = new Client();
    client.ftp.verbose = process.env.NODE_ENV !== 'production';

    try {
      await client.access(this.ftpConfig);
      await client.remove(filePath);
      await client.send('QUIT');
      return true;
    } catch (err) {
      console.error('FTP delete error:', err);
      return false;
    } finally {
      client.close();
    }
  }
}
