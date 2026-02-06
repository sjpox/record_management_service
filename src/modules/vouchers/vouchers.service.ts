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
  DateArchived: true,
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

  async getStats(): Promise<{
    totalCount: number;
    archivedCount: number;
    notArchivedCount: number;
    recentVouchers: Vouchers[];
  }> {
    const [archivedCount, notArchivedCount, recentVouchers] = await Promise.all([
      this.prisma.vouchers.count({ where: { IsArchived: true } }),
      this.prisma.vouchers.count({ where: { IsArchived: false } }),
      this.prisma.vouchers.findMany({
        take: 5,
        orderBy: { DateAdded: 'desc' },
        select: voucherSelectFields,
      }),
    ]);

    return {
      totalCount: archivedCount + notArchivedCount,
      archivedCount,
      notArchivedCount,
      recentVouchers: recentVouchers as unknown as Vouchers[],
    };
  }

  async findAll(
    pagination: PaginationDto,
    isArchived?: boolean,
    search?: string,
    filters?: {
      voucherNo?: string;
      transactionNo?: string;
      payee?: string;
      claimType?: string;
    },
  ): Promise<PaginatedResult<Vouchers>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (isArchived !== undefined) {
      where.IsArchived = isArchived;
    }

    const orConditions: Record<string, unknown>[] = [];

    if (search) {
      orConditions.push(
        { VoucherNo: { contains: search } },
        { TransactionNo: { contains: search } },
      );
    }

    if (filters?.voucherNo) {
      orConditions.push({ VoucherNo: { contains: filters.voucherNo } });
    }

    if (filters?.transactionNo) {
      orConditions.push({ TransactionNo: { contains: filters.transactionNo } });
    }

    if (filters?.payee) {
      orConditions.push({ Payee: { contains: filters.payee } });
    }

    if (filters?.claimType) {
      orConditions.push({ ClaimType: { contains: filters.claimType } });
    }

    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

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

  async findOneWithPhotos(id: number): Promise<{
    voucher: Vouchers;
    photos: { id: number; imageFile: string; imageFileType: string | null; base64: string }[];
  }> {
    const voucher = await this.prisma.vouchers.findUnique({
      where: { Id: id },
      select: {
        ...voucherSelectFields,
        VoucherImages: {
          select: {
            Id: true,
            ImageFile: true,
            ImageFileType: true,
          },
        },
      },
    });

    if (!voucher) throw new NotFoundException(`Voucher with ID ${id} not found`);

    const { VoucherImages, ...voucherData } = voucher;

    const photos = await Promise.all(
      VoucherImages.map(async (photo) => {
        try {
          const buffer = await this.ftpService.downloadFile(photo.ImageFile);
          const mimeType = this.ftpService.getMimeType(photo.ImageFile);
          const base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
          return {
            id: photo.Id,
            imageFile: photo.ImageFile,
            imageFileType: photo.ImageFileType,
            base64,
          };
        } catch {
          return {
            id: photo.Id,
            imageFile: photo.ImageFile,
            imageFileType: photo.ImageFileType,
            base64: '',
          };
        }
      }),
    );

    return {
      voucher: voucherData as unknown as Vouchers,
      photos,
    };
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

  async create(dto: CreateVoucherDto, userId: number, files?: Express.Multer.File[]): Promise<Vouchers> {
    // 1. Create voucher first
    const voucher = await this.prisma.vouchers.create({
      data: {
        VoucherNo: dto.VoucherNo,
        TransactionNo: dto.TransactionNo,
        Payee: dto.Payee,
        Particulars: dto.Particulars,
        ClaimType: dto.ClaimType,
        Amount: dto.Amount,
        DateDisbursed: new Date(dto.DateDisbursed),
        IsArchived: dto.IsArchived ?? false,
        AddedById: userId,
        LastModifiedById: userId,
      },
    });

    const uploadedFiles: string[] = [];

    try {
      // 2. Upload files (outside transaction to avoid timeout)
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
          await this.prisma.voucherImages.createMany({
            data: successfulUploads.map((filePath) => ({
              ImageFile: filePath,
              ImageFileType: 'webp',
              VoucherId: voucher.Id,
              EvidencedById: userId,
            })),
          });
        }
      }

      return this.findOne(voucher.Id);
    } catch (error) {
      // Rollback: Clean up uploaded files and delete voucher if photo upload failed
      if (uploadedFiles.length > 0) {
        await this.ftpService.deleteMultipleFiles(uploadedFiles);
      }
      // Delete the created voucher on error
      await this.prisma.vouchers.delete({ where: { Id: voucher.Id } });
      throw error;
    }
  }

  async update(id: number, dto: UpdateVoucherDto, userId: number): Promise<Vouchers> {
    await this.findOne(id);
    const { DateDisbursed, ...rest } = dto;
    const updated = await this.prisma.vouchers.update({
      where: { Id: id },
      data: {
        ...rest,
        DateDisbursed: DateDisbursed ? new Date(DateDisbursed) : undefined,
        LastModifiedById: userId,
      },
      select: voucherSelectFields,
    });
    return updated as unknown as Vouchers;
  }

  async updatePhotos(
    id: number,
    userId: number,
    deletePhotoIds?: number[],
    files?: Express.Multer.File[],
  ): Promise<{ added: number; deleted: number }> {
    const voucher = await this.findOne(id);

    if (!voucher.IsArchived) {
      throw new BadRequestException('Can only manage photos for archived vouchers');
    }

    let added = 0;
    let deleted = 0;
    const uploadedFiles: string[] = [];
    const filesToDeleteFromFtp: string[] = [];

    try {
      // 1. Handle deletions first
      if (deletePhotoIds && deletePhotoIds.length > 0) {
        const photosToDelete = await this.prisma.voucherImages.findMany({
          where: {
            Id: { in: deletePhotoIds },
            VoucherId: id,
          },
        });

        if (photosToDelete.length > 0) {
          filesToDeleteFromFtp.push(...photosToDelete.map((p) => p.ImageFile));

          await this.prisma.voucherImages.deleteMany({
            where: {
              Id: { in: photosToDelete.map((p) => p.Id) },
            },
          });

          deleted = photosToDelete.length;
        }
      }

      // 2. Handle additions
      if (files && files.length > 0) {
        const uploadResults = await this.ftpService.uploadMultipleVoucherFiles(files, 'vouchers', {
          voucherNo: voucher.VoucherNo,
          date: voucher.DateDisbursed,
        });

        const successfulUploads = uploadResults
          .filter((r) => r.success)
          .map((r) => r.filePath);

        uploadedFiles.push(...successfulUploads);

        if (successfulUploads.length > 0) {
          await this.prisma.voucherImages.createMany({
            data: successfulUploads.map((filePath) => ({
              ImageFile: filePath,
              ImageFileType: 'webp',
              VoucherId: id,
              EvidencedById: userId,
            })),
          });

          added = successfulUploads.length;
        }
      }

      // 3. Update last modified by
      if (added > 0 || deleted > 0) {
        await this.prisma.vouchers.update({
          where: { Id: id },
          data: { LastModifiedById: userId },
        });
      }

      // 4. Delete files from FTP after successful DB operations
      if (filesToDeleteFromFtp.length > 0) {
        await this.ftpService.deleteMultipleFiles(filesToDeleteFromFtp);
      }

      return { added, deleted };
    } catch (error) {
      // Rollback: Clean up newly uploaded files if operation failed
      if (uploadedFiles.length > 0) {
        await this.ftpService.deleteMultipleFiles(uploadedFiles);
      }
      throw error;
    }
  }

  async getPhotos(voucherId: number): Promise<{ id: number; imageFile: string; imageFileType: string | null }[]> {
    await this.findOne(voucherId); // Ensure voucher exists
    const photos = await this.prisma.voucherImages.findMany({
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

  async unarchive(id: number, userId: number): Promise<Vouchers> {
    await this.findOne(id);

    // Get photos for cleanup
    const photos = await this.prisma.voucherImages.findMany({ where: { VoucherId: id } });
    const filePaths = photos.map((p) => p.ImageFile);

    // Delete photos and set IsArchived to false in transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.voucherImages.deleteMany({ where: { VoucherId: id } });
      return tx.vouchers.update({
        where: { Id: id },
        data: { IsArchived: false, DateArchived: null, LastModifiedById: userId },
        select: voucherSelectFields,
      });
    });

    // Clean up files from FTP after successful DB operations
    if (filePaths.length > 0) {
      await this.ftpService.deleteMultipleFiles(filePaths);
    }

    return updated as unknown as Vouchers;
  }

  async bulkCreate(vouchers: CreateVoucherDto[], userId: number): Promise<{
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
                AddedById: userId,
                LastModifiedById: userId,
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

  async archive(id: number, userId: number, files?: Express.Multer.File[]): Promise<Vouchers> {
    const voucher = await this.findOne(id);

    if (voucher.IsArchived) {
      throw new BadRequestException('Voucher is already archived');
    }

    const uploadedFiles: string[] = [];

    try {
      // 1. Upload files first (outside transaction to avoid timeout)
      if (files && files.length > 0) {
        const uploadResults = await this.ftpService.uploadMultipleVoucherFiles(files, 'vouchers', {
          voucherNo: voucher.VoucherNo,
          date: voucher.DateDisbursed,
        });

        const successfulUploads = uploadResults
          .filter((r) => r.success)
          .map((r) => r.filePath);

        uploadedFiles.push(...successfulUploads);
      }

      // 2. Database operations in transaction (quick operations only)
      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.vouchers.update({
          where: { Id: id },
          data: { IsArchived: true, DateArchived: new Date(), LastModifiedById: userId },
        });

        if (uploadedFiles.length > 0) {
          await tx.voucherImages.createMany({
            data: uploadedFiles.map((filePath) => ({
              ImageFile: filePath,
              ImageFileType: 'webp',
              VoucherId: id,
              EvidencedById: userId,
            })),
          });
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
