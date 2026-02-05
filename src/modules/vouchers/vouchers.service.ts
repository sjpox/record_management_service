import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FtpService } from '../../common/services/ftp.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { Vouchers } from '@prisma/client';

// Select fields excluding photos
const voucherSelectFields = {
  Id: true,
  VoucherNo: true,
  TransactionNo: true,
  Payee: true,
  Particulars: true,
  ClaimType: true,
  Amount: true,
  DateDisbursed: true,
  IsArchived: true,
  DateAdded: true,
  DateLastUpdated: true,
  AddedById: true,
  LastModifiedById: true,
  AddedBy: {
    select: {
      Id: true,
      FirstName: true,
      LastName: true,
    },
  },
  LastModifiedBy: {
    select: {
      Id: true,
      FirstName: true,
      LastName: true,
    },
  },
};

@Injectable()
export class VouchersService {
  constructor(
    private prisma: PrismaService,
    private ftpService: FtpService,
  ) {}

  async findAll(
    pagination: PaginationDto,
    isArchived?: boolean,
  ): Promise<PaginatedResult<Vouchers>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const where = isArchived !== undefined ? { IsArchived: isArchived } : {};

    const [data, total] = await Promise.all([
      this.prisma.vouchers.findMany({
        where,
        skip,
        take: limit,
        select: voucherSelectFields,
        orderBy: { DateAdded: 'desc' },
      }),
      this.prisma.vouchers.count({ where }),
    ]);

    return {
      data: data as unknown as Vouchers[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Vouchers> {
    const item = await this.prisma.vouchers.findUnique({
      where: { Id: id },
      select: voucherSelectFields,
    });
    if (!item) throw new NotFoundException(`Voucher with ID ${id} not found`);
    return item as unknown as Vouchers;
  }

  async search(voucherNo: string, isArchived?: boolean): Promise<Vouchers[]> {
    const where: Record<string, unknown> = {
      VoucherNo: { contains: voucherNo },
    };
    if (isArchived !== undefined) {
      where.IsArchived = isArchived;
    }

    return this.prisma.vouchers.findMany({
      where,
      select: voucherSelectFields,
    }) as unknown as Promise<Vouchers[]>;
  }

  async create(dto: CreateVoucherDto, files?: Express.Multer.File[]): Promise<Vouchers> {
    const uploadedFiles: string[] = [];

    try {
      // Start transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Insert voucher data
        const voucher = await tx.vouchers.create({
          data: {
            VoucherNo: dto.VoucherNo,
            TransactionNo: dto.TransactionNo,
            Payee: dto.Payee,
            Particulars: dto.Particulars,
            ClaimType: dto.ClaimType,
            Amount: dto.Amount,
            DateDisbursed: new Date(dto.DateDisbursed),
            IsArchived: dto.IsArchived ?? false,
            AddedById: dto.AddedById,
            LastModifiedById: dto.LastModifiedById,
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
                ImageFileType: 'webp',
                VoucherId: voucher.Id,
                EvidencedById: dto.AddedById,
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
    const updated = await this.prisma.vouchers.update({
      where: { Id: id },
      data: {
        ...rest,
        DateDisbursed: DateDisbursed ? new Date(DateDisbursed) : undefined,
      },
      select: voucherSelectFields,
    });
    return updated as unknown as Vouchers;
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
              ImageFileType: 'webp',
              VoucherId: id,
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
    const photo = await this.prisma.vouPhotos.findUnique({ where: { Id: photoId } });
    if (!photo) throw new NotFoundException(`Photo with ID ${photoId} not found`);

    // Delete from DB first, then from FTP
    await this.prisma.vouPhotos.delete({ where: { Id: photoId } });
    await this.ftpService.deleteFile(photo.ImageFile);
  }

  async getPhotos(voucherId: number): Promise<{ id: number; imageFile: string; imageFileType: string | null }[]> {
    await this.findOne(voucherId); // Ensure voucher exists
    const photos = await this.prisma.vouPhotos.findMany({
      where: { VoucherId: voucherId },
      select: {
        Id: true,
        ImageFile: true,
        ImageFileType: true,
      },
    });
    return photos.map((p) => ({
      id: p.Id,
      imageFile: p.ImageFile,
      imageFileType: p.ImageFileType,
    }));
  }

  async remove(id: number): Promise<Vouchers> {
    await this.findOne(id);

    // Get photos for cleanup
    const photos = await this.prisma.vouPhotos.findMany({ where: { VoucherId: id } });
    const filePaths = photos.map((p) => p.ImageFile);

    // Delete from DB in transaction
    const deleted = await this.prisma.$transaction(async (tx) => {
      await tx.vouPhotos.deleteMany({ where: { VoucherId: id } });
      return tx.vouchers.delete({ where: { Id: id } });
    });

    // Clean up files from FTP after successful DB deletion
    if (filePaths.length > 0) {
      await this.ftpService.deleteMultipleFiles(filePaths);
    }

    return deleted;
  }

  async bulkCreate(vouchers: CreateVoucherDto[]): Promise<{
    created: number;
    skipped: number;
    failed: number;
    duplicates: string[];
    errors: string[];
  }> {
    const errors: string[] = [];
    const duplicates: string[] = [];
    let created = 0;
    let skipped = 0;
    let failed = 0;

    // Extract all voucher numbers from the input
    const inputVoucherNos = vouchers.map((v) => v.VoucherNo);

    // Check for existing vouchers in the database
    const existingVouchers = await this.prisma.vouchers.findMany({
      where: {
        VoucherNo: { in: inputVoucherNos },
      },
      select: { VoucherNo: true },
    });

    const existingVoucherNos = new Set(existingVouchers.map((v) => v.VoucherNo));

    // Also check for duplicates within the input itself
    const seenVoucherNos = new Set<string>();
    const inputDuplicates = new Set<string>();

    for (const dto of vouchers) {
      if (seenVoucherNos.has(dto.VoucherNo)) {
        inputDuplicates.add(dto.VoucherNo);
      }
      seenVoucherNos.add(dto.VoucherNo);
    }

    // Filter out duplicates and process only unique, non-existing vouchers
    const vouchersToCreate: CreateVoucherDto[] = [];
    const processedVoucherNos = new Set<string>();

    for (const dto of vouchers) {
      if (existingVoucherNos.has(dto.VoucherNo)) {
        if (!duplicates.includes(dto.VoucherNo)) {
          duplicates.push(dto.VoucherNo);
        }
        skipped++;
      } else if (processedVoucherNos.has(dto.VoucherNo)) {
        // Duplicate within input - skip subsequent occurrences
        if (!duplicates.includes(dto.VoucherNo)) {
          duplicates.push(dto.VoucherNo);
        }
        skipped++;
      } else {
        vouchersToCreate.push(dto);
        processedVoucherNos.add(dto.VoucherNo);
      }
    }

    // Process valid vouchers in transaction
    if (vouchersToCreate.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const dto of vouchersToCreate) {
          try {
            await tx.vouchers.create({
              data: {
                VoucherNo: dto.VoucherNo,
                TransactionNo: dto.TransactionNo,
                Payee: dto.Payee,
                Particulars: dto.Particulars,
                ClaimType: dto.ClaimType,
                Amount: dto.Amount,
                DateDisbursed: new Date(dto.DateDisbursed),
                IsArchived: dto.IsArchived ?? false,
                AddedById: dto.AddedById,
                LastModifiedById: dto.LastModifiedById,
              },
            });
            created++;
          } catch (error) {
            failed++;
            const message = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Voucher ${dto.VoucherNo}: ${message}`);
          }
        }
      });
    }

    return { created, skipped, failed, duplicates, errors };
  }

  async archive(id: number, files?: Express.Multer.File[]): Promise<Vouchers> {
    const voucher = await this.findOne(id);

    if (voucher.IsArchived) {
      throw new BadRequestException('Voucher is already archived');
    }

    const uploadedFiles: string[] = [];

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Update voucher to archived
        const updated = await tx.vouchers.update({
          where: { Id: id },
          data: { IsArchived: true },
        });

        // 2. Process and upload files if any
        if (files && files.length > 0) {
          const uploadResults = await this.ftpService.uploadMultipleVoucherFiles(files, 'vouchers', {
            voucherNo: voucher.VoucherNo,
            date: voucher.DateDisbursed,
          });

          const successfulUploads = uploadResults
            .filter((r) => r.success)
            .map((r) => r.filePath);

          uploadedFiles.push(...successfulUploads);

          // 3. Insert photo records
          if (successfulUploads.length > 0) {
            await tx.vouPhotos.createMany({
              data: successfulUploads.map((filePath) => ({
                ImageFile: filePath,
                ImageFileType: 'webp',
                VoucherId: id,
              })),
            });
          }
        }

        return updated;
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
}
