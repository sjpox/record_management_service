import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FtpService } from '../../common/services/ftp.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { Vouchers } from '@prisma/client';

@Injectable()
export class VouchersService {
  constructor(
    private prisma: PrismaService,
    private ftpService: FtpService,
  ) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<Vouchers>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.vouchers.findMany({
        skip,
        take: limit,
        include: { VouPhotos: true },
      }),
      this.prisma.vouchers.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Vouchers> {
    const item = await this.prisma.vouchers.findUnique({
      where: { Id: id },
      include: { VouPhotos: true },
    });
    if (!item) throw new NotFoundException(`Voucher with ID ${id} not found`);
    return item;
  }

  async search(voucherNo: string): Promise<Vouchers[]> {
    return this.prisma.vouchers.findMany({
      where: { VoucherNo: { contains: voucherNo } },
      include: { VouPhotos: true },
    });
  }

  async create(dto: CreateVoucherDto, files?: Express.Multer.File[]): Promise<Vouchers> {
    const uploadedFiles: string[] = [];

    try {
      // Start transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Insert voucher data
        const voucher = await tx.vouchers.create({
          data: {
            ...dto,
            Amount: dto.Amount,
            DateDisbursed: dto.DateDisbursed,
          },
        });

        // 2. Process and upload files
        if (files && files.length > 0) {
          const uploadResults = await this.ftpService.uploadMultipleVoucherFiles(files, 'vouchers', {
            voucherNo: voucher.VoucherNo,
            date: voucher.DateDisbursed,
          });

          const successfulUploads = uploadResults
            .filter((r) => r.success)
            .map((r) => r.filePath);

          // Track uploaded files for potential cleanup
          uploadedFiles.push(...successfulUploads);

          // 3. Insert photo records
          if (successfulUploads.length > 0) {
            await tx.vouPhotos.createMany({
              data: successfulUploads.map((filePath) => ({
                ImageFile: filePath,
                Voucher_Id: voucher.Id,
              })),
            });
          }
        }

        return voucher;
      });

      return this.findOne(result.Id);
    } catch (error) {
      // Rollback: Clean up uploaded files if transaction failed
      if (uploadedFiles.length > 0) {
        await this.ftpService.deleteMultipleFiles(uploadedFiles);
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateVoucherDto): Promise<Vouchers> {
    await this.findOne(id);
    const { DateDisbursed, ...rest } = dto;
    return this.prisma.vouchers.update({
      where: { Id: id },
      data: {
        ...rest,
        DateDisbursed: DateDisbursed ? new Date(DateDisbursed) : undefined,
      },
      include: { VouPhotos: true },
    });
  }

  async addPhotos(id: number, files: Express.Multer.File[]): Promise<{ count: number }> {
    const voucher = await this.findOne(id);
    const uploadedFiles: string[] = [];

    try {
      // Upload files first
      const uploadResults = await this.ftpService.uploadMultipleVoucherFiles(files, 'vouchers', {
        voucherNo: voucher.VoucherNo,
        date: voucher.DateDisbursed,
      });

      const successfulUploads = uploadResults
        .filter((r) => r.success)
        .map((r) => r.filePath);

      uploadedFiles.push(...successfulUploads);

      // Insert photo records in transaction
      if (successfulUploads.length > 0) {
        await this.prisma.$transaction(async (tx) => {
          await tx.vouPhotos.createMany({
            data: successfulUploads.map((filePath) => ({
              ImageFile: filePath,
              Voucher_Id: id,
            })),
          });
        });
      }

      return { count: successfulUploads.length };
    } catch (error) {
      // Rollback: Clean up uploaded files if DB insert failed
      if (uploadedFiles.length > 0) {
        await this.ftpService.deleteMultipleFiles(uploadedFiles);
      }
      throw error;
    }
  }

  async deletePhoto(photoId: number): Promise<void> {
    const photo = await this.prisma.vouPhotos.findUnique({ where: { Vou_Id: photoId } });
    if (!photo) throw new NotFoundException(`Photo with ID ${photoId} not found`);

    // Delete from DB first, then from FTP
    await this.prisma.vouPhotos.delete({ where: { Vou_Id: photoId } });
    await this.ftpService.deleteFile(photo.ImageFile);
  }

  async remove(id: number): Promise<Vouchers> {
    const voucher = await this.findOne(id);

    // Get photos for cleanup
    const photos = await this.prisma.vouPhotos.findMany({ where: { Voucher_Id: id } });
    const filePaths = photos.map((p) => p.ImageFile);

    // Delete from DB in transaction
    const deleted = await this.prisma.$transaction(async (tx) => {
      await tx.vouPhotos.deleteMany({ where: { Voucher_Id: id } });
      return tx.vouchers.delete({ where: { Id: id } });
    });

    // Clean up files from FTP after successful DB deletion
    if (filePaths.length > 0) {
      await this.ftpService.deleteMultipleFiles(filePaths);
    }

    return deleted;
  }
}
