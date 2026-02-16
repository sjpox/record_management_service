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
  private readonly apiBaseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  private readonly imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];

  private isImage(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return this.imageExtensions.includes(ext);
  }

  private async convertToWebp(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .webp({
        quality: 85,
        smartSubsample: false,
        effort: 4,
      })
      .toBuffer();
  }

  private async convertToPng(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .png({
        compressionLevel: 6,
      })
      .toBuffer();
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

  private async convertToJpeg(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .jpeg({ quality: 85 })
      .toBuffer();
  }

  private getWebpFilename(filename: string): string {
    const ext = path.extname(filename);
    return filename.replace(ext, '.webp');
  }

  private getPngFilename(filename: string): string {
    const ext = path.extname(filename);
    return filename.replace(ext, '.png');
  }

  private getJpegFilename(filename: string): string {
    const ext = path.extname(filename);
    return filename.replace(ext, '.jpg');
  }

  /**
   * Process file: convert to JPEG if image
   */
  private async processFile(file: Express.Multer.File): Promise<ProcessedFile> {
    let buffer = file.buffer;
    let filename = file.originalname;

    if (this.isImage(filename)) {
      try {
        buffer = await this.convertToJpeg(file.buffer);
        filename = this.getJpegFilename(filename);
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

      return { success: true, filePath: fullFilePath, fileSize: processed.buffer.length };
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
          results.push({ success: true, filePath: fullFilePath, fileSize: processed.buffer.length });
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

  async deleteDirectory(dirPath: string): Promise<boolean> {
    const client = new Client();
    client.ftp.verbose = process.env.NODE_ENV !== 'production';

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
    const client = new Client();
    client.ftp.verbose = process.env.NODE_ENV !== 'production';

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

    const client = new Client();
    client.ftp.verbose = process.env.NODE_ENV !== 'production';
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
    const client = new Client();
    client.ftp.verbose = process.env.NODE_ENV !== 'production';

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
        .jpeg({ quality: 85 })
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

    const client = new Client();
    client.ftp.verbose = process.env.NODE_ENV !== 'production';
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
