import { Injectable } from '@nestjs/common';
import { Client } from 'basic-ftp';
import * as path from 'path';
import { Readable, Writable } from 'stream';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';

export interface ImageEntry {
  buffer: Buffer;
  crop?: { left: number; top: number; width: number; height: number };
}

export interface UploadResult {
  success: boolean;
  filePath: string;
  fileSize?: number;
  error?: string;
}

export interface VoucherUploadOptions {
  voucherNo: string;
  date?: Date;
}

export interface IndexDocumentUploadOptions {
  payee: string;
  periodStart: Date;
  periodEnd: Date;
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

  private readonly ftpTimeout = Number(process.env.FTP_TIMEOUT) || 10000;

  private readonly baseUploadDir = process.env.FTP_UPLOAD_DIR ?? '/ftp';
  private readonly apiBaseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

  private createFtpClient(): Client {
    const client = new Client(this.ftpTimeout);
    client.ftp.verbose = process.env.NODE_ENV !== 'production';
    return client;
  }

  /**
   * Apply document scan effect: normalize, contrast, sharpen, brighten
   */
  private async scanEffect(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .normalize()
      .linear(1.3, -(128 * 0.3))
      .modulate({ brightness: 1.1 })
      .sharpen({ sigma: 1.0, m1: 1.0, m2: 0.5 })
      .toBuffer();
  }

  async enhanceImage(buffer: Buffer): Promise<Buffer> {
    const scanned = await this.scanEffect(buffer);
    return sharp(scanned)
      .png({ compressionLevel: 6 })
      .toBuffer();
  }

  private readonly imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];

  private isImage(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return this.imageExtensions.includes(ext);
  }

  private async convertToJpeg(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer).jpeg({ quality: 100 }).toBuffer();
  }

  private getJpegFilename(filename: string): string {
    const ext = path.extname(filename);
    return filename.replace(ext, '.jpg');
  }

  buildIndexDocumentPath(options: IndexDocumentUploadOptions): string {
    const payee = options.payee.replace(/[^a-zA-Z0-9-_ ]/g, '_').trim();
    const startMonth = (options.periodStart.getMonth() + 1).toString().padStart(2, '0');
    const startYear = options.periodStart.getFullYear().toString();
    const endMonth = (options.periodEnd.getMonth() + 1).toString().padStart(2, '0');
    const endYear = options.periodEnd.getFullYear().toString();
    const period = `${startYear}-${startMonth}_to_${endYear}-${endMonth}`;

    return path.posix.join(this.baseUploadDir, 'index-documents', payee, period);
  }

  buildOtherDocumentPath(title: string): string {
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, '_').trim();
    return path.posix.join(this.baseUploadDir, 'other-documents', sanitizedTitle);
  }

  buildCommImagePath(refNumber: string): string {
    const sanitizedRef = refNumber.replace(/[^a-zA-Z0-9-_]/g, '_').trim();
    return path.posix.join(this.baseUploadDir, 'communications', sanitizedRef);
  }

  async uploadCommFiles(
    files: Express.Multer.File[],
    refNumber: string,
  ): Promise<UploadResult[]> {
    if (files.length === 0) return [];
    const remotePath = this.buildCommImagePath(refNumber);
    return this.uploadFilesToPath(files, remotePath);
  }

  buildCommReplyPath(refNumber: string, actionId: number): string {
    const sanitizedRef = refNumber.replace(/[^a-zA-Z0-9-_]/g, '_').trim();
    return path.posix.join(this.baseUploadDir, 'communications', sanitizedRef, `action-${actionId}`);
  }

  async uploadCommReplyFiles(
    files: Express.Multer.File[],
    refNumber: string,
    actionId: number,
  ): Promise<UploadResult[]> {
    if (files.length === 0) return [];
    const remotePath = this.buildCommReplyPath(refNumber, actionId);
    return this.uploadFilesToPath(files, remotePath);
  }

  async uploadOtherDocumentFiles(
    files: Express.Multer.File[],
    title: string,
  ): Promise<UploadResult[]> {
    if (files.length === 0) return [];

    const remotePath = this.buildOtherDocumentPath(title);
    return this.uploadFilesToPath(files, remotePath);
  }

  async uploadIndexDocumentFiles(
    files: Express.Multer.File[],
    options: IndexDocumentUploadOptions,
  ): Promise<UploadResult[]> {
    if (files.length === 0) return [];

    const remotePath = this.buildIndexDocumentPath(options);
    return this.uploadFilesToPath(files, remotePath);
  }

  private async uploadFilesToPath(
    files: Express.Multer.File[],
    remotePath: string,
  ): Promise<UploadResult[]> {
    const client = this.createFtpClient();
    const results: UploadResult[] = [];

    try {
      await client.access(this.ftpConfig);
      await client.ensureDir(remotePath);

      for (const file of files) {
        let buffer = file.buffer;
        let filename = file.originalname;
        if (this.isImage(filename)) {
          buffer = await this.convertToJpeg(buffer);
          filename = this.getJpegFilename(filename);
        }
        const fullFilePath = path.posix.join(remotePath, filename);
        try {
          await client.uploadFrom(Readable.from([buffer]), fullFilePath);
          results.push({ success: true, filePath: fullFilePath, fileSize: buffer.length });
        } catch (err) {
          console.error('FTP upload error:', err);
          results.push({
            success: false,
            filePath: '',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      // Verify uploads
      const successfulResults = results.filter((r) => r.success);
      for (const result of successfulResults) {
        try {
          await client.size(result.filePath);
        } catch {
          const idx = results.findIndex((r) => r.filePath === result.filePath);
          if (idx !== -1) {
            results[idx] = {
              success: false,
              filePath: '',
              error: 'Upload verification failed — file not found on server',
            };
          }
        }
      }

      return results;
    } catch (err) {
      console.error('FTP connection error:', err);
      return files.map(() => ({
        success: false,
        filePath: '',
        error: err instanceof Error ? err.message : 'Connection error',
      }));
    } finally {
      client.close();
    }
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
    const client = this.createFtpClient();

    try {
      let buffer = file.buffer;
      let filename = file.originalname;
      if (this.isImage(filename)) {
        buffer = await this.convertToJpeg(buffer);
        filename = this.getJpegFilename(filename);
      }
      const fullFilePath = path.posix.join(remotePath, filename);

      await client.access(this.ftpConfig);
      await client.ensureDir(remotePath);
      await client.uploadFrom(Readable.from([buffer]), fullFilePath);

      return { success: true, filePath: fullFilePath, fileSize: buffer.length };
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

    // Single FTP connection for all uploads
    const client = this.createFtpClient();
    const results: UploadResult[] = [];

    try {
      await client.access(this.ftpConfig);
      await client.ensureDir(remotePath);

      // Upload all files using the same connection
      for (const file of files) {
        let buffer = file.buffer;
        let filename = file.originalname;
        if (this.isImage(filename)) {
          buffer = await this.convertToJpeg(buffer);
          filename = this.getJpegFilename(filename);
        }
        const fullFilePath = path.posix.join(remotePath, filename);
        try {
          await client.uploadFrom(Readable.from([buffer]), fullFilePath);
          results.push({ success: true, filePath: fullFilePath, fileSize: buffer.length });
        } catch (err) {
          console.error('FTP upload error:', err);
          results.push({
            success: false,
            filePath: '',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      // Verify all successful uploads actually exist on FTP
      const successfulResults = results.filter((r) => r.success);
      if (successfulResults.length > 0) {
        const verifyPaths = successfulResults.map((r) => r.filePath);
        for (const filePath of verifyPaths) {
          try {
            await client.size(filePath);
          } catch {
            // File doesn't exist on FTP despite successful upload — mark as failed
            const idx = results.findIndex((r) => r.filePath === filePath);
            if (idx !== -1) {
              console.error(`FTP upload verification failed: ${filePath}`);
              results[idx] = {
                success: false,
                filePath: '',
                error: 'Upload verification failed — file not found on server',
              };
            }
          }
        }
      }

      return results;
    } catch (err) {
      console.error('FTP connection error:', err);
      // Return failure for all files if connection failed
      return files.map(() => ({
        success: false,
        filePath: '',
        error: err instanceof Error ? err.message : 'Connection error',
      }));
    } finally {
      client.close();
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    const client = this.createFtpClient();

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

    const client = this.createFtpClient();
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

  async deleteDirectory(dirPath: string): Promise<boolean> {
    const client = this.createFtpClient();

    try {
      await client.access(this.ftpConfig);
      await client.removeDir(dirPath);
      return true;
    } catch (err) {
      console.error('FTP delete directory error:', err);
      return false;
    } finally {
      client.close();
    }
  }

  getFileUrl(filePath: string): string {
    return `${this.apiBaseUrl}/api/files${filePath}`;
  }

  async downloadFile(filePath: string): Promise<Buffer> {
    const client = this.createFtpClient();

    try {
      await client.access(this.ftpConfig);

      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      await client.downloadTo(writable, filePath);
      return Buffer.concat(chunks);
    } finally {
      client.close();
    }
  }

  async downloadMultipleFiles(filePaths: string[]): Promise<Map<string, Buffer | null>> {
    if (filePaths.length === 0) return new Map();

    const client = this.createFtpClient();
    const results = new Map<string, Buffer | null>();

    try {
      await client.access(this.ftpConfig);

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
          results.set(filePath, Buffer.concat(chunks));
        } catch {
          results.set(filePath, null);
        }
      }

      return results;
    } catch (err) {
      console.error('FTP connection error:', err);
      for (const filePath of filePaths) {
        results.set(filePath, null);
      }
      return results;
    } finally {
      client.close();
    }
  }

  /**
   * Compose multiple image buffers into a single PDF
   */
  async composeToPdf(imageEntries: ImageEntry[], isBlackAndWhite = false, isScanEffect = false): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const processImages = async () => {
        const pageWidth = 595;
        const pageHeight = 842;

        for (const entry of imageEntries) {
          // Crop if specified, then resize and apply effects
          let pipeline = sharp(entry.buffer);
          if (entry.crop) {
            pipeline = pipeline.extract({
              left: Math.round(entry.crop.left),
              top: Math.round(entry.crop.top),
              width: Math.round(entry.crop.width),
              height: Math.round(entry.crop.height),
            });
          }
          pipeline = pipeline.resize({ width: 1200, withoutEnlargement: true });
          if (isBlackAndWhite) pipeline = pipeline.grayscale();
          const resized = await pipeline.toBuffer();
          const processed = isScanEffect ? await this.scanEffect(resized) : resized;
          const enhanced = await sharp(processed)
            .png({ compressionLevel: 6 })
            .toBuffer();

          const metadata = await sharp(enhanced).metadata();
          const imgWidth = metadata.width ?? pageWidth;
          const imgHeight = metadata.height ?? pageHeight;

          // Fit to frame: scale image to fill A4 page while maintaining aspect ratio
          const scaleX = pageWidth / imgWidth;
          const scaleY = pageHeight / imgHeight;
          const scale = Math.min(scaleX, scaleY);
          const fitWidth = imgWidth * scale;
          const fitHeight = imgHeight * scale;

          // Center on page
          const x = (pageWidth - fitWidth) / 2;
          const y = (pageHeight - fitHeight) / 2;

          doc.addPage({ size: [pageWidth, pageHeight], margin: 0 });
          doc.image(enhanced, x, y, { width: fitWidth, height: fitHeight });
        }
        doc.end();
      };

      processImages().catch(reject);
    });
  }

  async cropAndReupload(
    filePath: string,
    crop: { left: number; top: number; width: number; height: number },
  ): Promise<{ success: boolean; fileSize: number }> {
    const client = this.createFtpClient();

    try {
      await client.access(this.ftpConfig);

      // Download original file
      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });
      await client.downloadTo(writable, filePath);
      const original = Buffer.concat(chunks);

      // Crop and convert to JPEG
      const cropped = await sharp(original)
        .extract({
          left: Math.round(crop.left),
          top: Math.round(crop.top),
          width: Math.round(crop.width),
          height: Math.round(crop.height),
        })
        .jpeg({ quality: 100 })
        .toBuffer();

      // Overwrite the original file
      await client.uploadFrom(Readable.from([cropped]), filePath);

      return { success: true, fileSize: cropped.length };
    } catch (err) {
      console.error('FTP crop and reupload error:', err);
      return { success: false, fileSize: 0 };
    } finally {
      client.close();
    }
  }

  async checkFilesExist(filePaths: string[]): Promise<Map<string, boolean>> {
    if (filePaths.length === 0) return new Map();

    const client = this.createFtpClient();
    const results = new Map<string, boolean>();

    try {
      await client.access(this.ftpConfig);

      for (const filePath of filePaths) {
        try {
          await client.size(filePath);
          results.set(filePath, true);
        } catch {
          results.set(filePath, false);
        }
      }

      return results;
    } catch (err) {
      console.error('FTP connection error:', err);
      for (const filePath of filePaths) {
        results.set(filePath, false);
      }
      return results;
    } finally {
      client.close();
    }
  }

  getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.pdf': 'application/pdf',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
