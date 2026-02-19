import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { FtpService } from '../../common/services/ftp.service';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly reportsDir = process.env.REPORTS_OUTPUT_DIR ?? path.join(process.cwd(), 'reports');

  constructor(
    private readonly prisma: PrismaService,
    private readonly ftpService: FtpService,
  ) {}

  @Cron('*/10 * * * * *', { name: 'voucher-image-discrepancy-report' })
  async handleDiscrepancyReport(): Promise<void> {
    this.logger.log('Starting voucher image discrepancy report...');
    const startTime = Date.now();

    try {
      // 1. Query all archived vouchers that have at least one image
      const vouchers = await this.prisma.vouchers.findMany({
        where: {
          IsArchived: true,
          VoucherImages: { some: {} },
        },
        select: {
          Id: true,
          VoucherNo: true,
          VoucherImages: {
            select: { ImageFile: true },
          },
          _count: {
            select: { VoucherImages: true },
          },
        },
      });

      if (vouchers.length === 0) {
        this.logger.log('No archived vouchers with images found. Skipping.');
        return;
      }

      // 2. Batch FTP file existence checks (500 per batch to avoid timeout)
      const allFilePaths = vouchers.flatMap((v) => v.VoucherImages.map((img) => img.ImageFile));
      const fileExistence = new Map<string, boolean>();
      const BATCH_SIZE = 500;

      for (let i = 0; i < allFilePaths.length; i += BATCH_SIZE) {
        const batch = allFilePaths.slice(i, i + BATCH_SIZE);
        const batchResults = await this.ftpService.checkFilesExist(batch);
        for (const [filePath, exists] of batchResults) {
          fileExistence.set(filePath, exists);
        }
      }

      // 3. Filter to discrepancies only
      const discrepancies: {
        voucherNo: string;
        dbImageCount: number;
        ftpFileCount: number;
        missingFiles: string[];
      }[] = [];

      for (const voucher of vouchers) {
        const dbCount = voucher._count.VoucherImages;
        const ftpCount = voucher.VoucherImages.filter(
          (img) => fileExistence.get(img.ImageFile) === true,
        ).length;

        if (dbCount !== ftpCount) {
          const missingFiles = voucher.VoucherImages
            .filter((img) => fileExistence.get(img.ImageFile) !== true)
            .map((img) => img.ImageFile);

          discrepancies.push({
            voucherNo: voucher.VoucherNo,
            dbImageCount: dbCount,
            ftpFileCount: ftpCount,
            missingFiles,
          });
        }
      }

      if (discrepancies.length === 0) {
        this.logger.log('No discrepancies found. Skipping report generation.');
        return;
      }

      // 4. Generate Excel report
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Record Management Service';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Image Discrepancies');

      sheet.columns = [
        { header: 'Voucher No', key: 'voucherNo', width: 25 },
        { header: 'DB Image Count', key: 'dbImageCount', width: 18 },
        { header: 'FTP File Count', key: 'ftpFileCount', width: 18 },
        { header: 'Missing Files', key: 'missingFiles', width: 60 },
      ];

      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' },
      };

      for (const row of discrepancies) {
        sheet.addRow({
          voucherNo: row.voucherNo,
          dbImageCount: row.dbImageCount,
          ftpFileCount: row.ftpFileCount,
          missingFiles: row.missingFiles.join('\n'),
        });
      }

      sheet.autoFilter = {
        from: 'A1',
        to: `D${discrepancies.length + 1}`,
      };

      // 5. Save to reports directory
      if (!fs.existsSync(this.reportsDir)) {
        fs.mkdirSync(this.reportsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `image-discrepancy-report-${timestamp}.xlsx`;
      const filepath = path.join(this.reportsDir, filename);

      await workbook.xlsx.writeFile(filepath);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(
        `Report saved: ${filepath} (${discrepancies.length} discrepancies found in ${duration}s)`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to generate discrepancy report',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
