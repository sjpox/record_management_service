import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FtpService } from '../../common/services/ftp.service';
import { AuditService } from '../audit/audit.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { Vouchers } from '@prisma/client';
import sharp from 'sharp';

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
  _count: {
    select: {
      VoucherImages: true,
    },
  },
};

@Injectable()
export class VouchersService {
  constructor(
    private prisma: PrismaService,
    private ftpService: FtpService,
    private auditService: AuditService,
  ) {}

  /**
   * Validate that all uploaded files are valid, non-corrupt images.
   * Throws BadRequestException if any file is malformed.
   */
  private async validateImageFiles(files: Express.Multer.File[]): Promise<void> {
    const errors: string[] = [];

    for (const file of files) {
      if (!file.buffer || file.buffer.length === 0) {
        errors.push(`${file.originalname}: file is empty`);
        continue;
      }

      try {
        const metadata = await sharp(file.buffer).metadata();
        if (!metadata.width || !metadata.height || metadata.width === 0 || metadata.height === 0) {
          errors.push(`${file.originalname}: image has invalid dimensions`);
        }
      } catch {
        errors.push(`${file.originalname}: image is corrupted or unreadable`);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `${errors.length} image${errors.length !== 1 ? 's are' : ' is'} corrupted or invalid: ${errors.join('; ')}`,
      );
    }
  }

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
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
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
        select: {
          ...voucherSelectFields,
          VoucherImages: {
            select: { ImageFile: true },
          },
        },
        orderBy: { [sortBy ?? 'DateAdded']: sortOrder ?? 'desc' },
      }),
      this.prisma.vouchers.count({ where }),
    ]);

    // Collect all file paths across all vouchers for a single FTP check
    const allFilePaths = data.flatMap((v) => v.VoucherImages.map((img) => img.ImageFile));
    const fileExistence = await this.ftpService.checkFilesExist(allFilePaths);

    const mappedData = data.map(({ VoucherImages, ...voucher }) => ({
      ...voucher,
      ftpFileCount: VoucherImages.filter((img) => fileExistence.get(img.ImageFile) === true).length,
    }));

    return {
      data: mappedData as unknown as Vouchers[],
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
    photoCount: number;
    ftpFileCount: number;
    photos: { id: number; imageFile: string; imageFileType: string | null; imageFileSize: number | null; base64: string }[];
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
            ImageFileSize: true,
          },
        },
      },
    });

    if (!voucher) throw new NotFoundException(`Voucher with ID ${id} not found`);

    const { VoucherImages, ...voucherData } = voucher;

    const filePaths = VoucherImages.map((p) => p.ImageFile);
    const downloadedFiles = await this.ftpService.downloadMultipleFiles(filePaths);

    const photos = await Promise.all(
      VoucherImages.map(async (photo) => {
        const buffer = downloadedFiles.get(photo.ImageFile);
        if (buffer) {
          const mimeType = this.ftpService.getMimeType(photo.ImageFile);
          const base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
          return {
            id: photo.Id,
            imageFile: photo.ImageFile,
            imageFileType: photo.ImageFileType,
            imageFileSize: photo.ImageFileSize,
            base64,
          };
        }
        return {
          id: photo.Id,
          imageFile: photo.ImageFile,
          imageFileType: photo.ImageFileType,
          imageFileSize: photo.ImageFileSize,
          base64: '',
        };
      }),
    );

    const ftpFileCount = filePaths.filter((fp) => downloadedFiles.get(fp) !== null).length;

    return {
      voucher: voucherData as unknown as Vouchers,
      photoCount: VoucherImages.length,
      ftpFileCount,
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
    if (files && files.length > 0) {
      await this.validateImageFiles(files);
    }

    const uploadedFiles: string[] = [];

    try {
      const voucher = await this.prisma.$transaction(async (tx) => {
        // 1. Create voucher
        const created = await tx.vouchers.create({
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

        // 2. Upload files
        if (files && files.length > 0) {
          const uploadResults = await this.ftpService.uploadMultipleVoucherFiles(files, 'vouchers', {
            voucherNo: created.VoucherNo,
            date: created.DateDisbursed,
          });

          const successfulUploads = uploadResults.filter((r) => r.success);
          const failedUploads = uploadResults.filter((r) => !r.success);

          uploadedFiles.push(...successfulUploads.map((r) => r.filePath));

          if (failedUploads.length > 0) {
            throw new BadRequestException(
              `Failed to upload ${failedUploads.length} of ${files.length} image(s). Please try again.`,
            );
          }

          // 3. Insert photo records
          if (successfulUploads.length > 0) {
            await tx.voucherImages.createMany({
              data: successfulUploads.map((r) => ({
                ImageFile: r.filePath,
                ImageFileType: 'jpeg',
                ImageFileSize: r.fileSize ?? null,
                VoucherId: created.Id,
                EvidencedById: userId,
              })),
            });
          }
        }

        return created;
      }, { timeout: 30000 });

      const result = await this.findOne(voucher.Id);

      this.auditService.log({
        entityType: 'Voucher',
        entityId: voucher.Id,
        action: 'CREATE',
        userId,
      });

      return result;
    } catch (error) {
      // Rollback: Clean up uploaded files if transaction failed
      if (uploadedFiles.length > 0) {
        await this.ftpService.deleteMultipleFiles(uploadedFiles);
      }
      this.auditService.log({
        entityType: 'Voucher',
        action: 'CREATE_ERROR',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async update(id: number, dto: UpdateVoucherDto, userId: number): Promise<Vouchers> {
    try {
      const { DateDisbursed, ...rest } = dto;

      const { before, updated } = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.vouchers.findUnique({
          where: { Id: id },
          select: voucherSelectFields,
        });
        if (!existing) throw new NotFoundException(`Voucher with ID ${id} not found`);

        const result = await tx.vouchers.update({
          where: { Id: id },
          data: {
            ...rest,
            DateDisbursed: DateDisbursed ? new Date(DateDisbursed) : undefined,
            LastModifiedById: userId,
          },
          select: voucherSelectFields,
        });

        return { before: existing, updated: result };
      });

      this.auditService.log({
        entityType: 'Voucher',
        entityId: id,
        action: 'UPDATE',
        userId,
        changes: { before, after: updated },
      });

      return updated as unknown as Vouchers;
    } catch (error) {
      this.auditService.log({
        entityType: 'Voucher',
        entityId: id,
        action: 'UPDATE_ERROR',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
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

    if (files && files.length > 0) {
      await this.validateImageFiles(files);
    }

    let added = 0;
    let deleted = 0;
    const uploadedFiles: string[] = [];
    const filesToDeleteFromFtp: string[] = [];

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Handle deletions first
        if (deletePhotoIds && deletePhotoIds.length > 0) {
          const photosToDelete = await tx.voucherImages.findMany({
            where: {
              Id: { in: deletePhotoIds },
              VoucherId: id,
            },
          });

          if (photosToDelete.length > 0) {
            filesToDeleteFromFtp.push(...photosToDelete.map((p) => p.ImageFile));

            await tx.voucherImages.deleteMany({
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

          const successfulUploads = uploadResults.filter((r) => r.success);
          const failedUploads = uploadResults.filter((r) => !r.success);

          uploadedFiles.push(...successfulUploads.map((r) => r.filePath));

          if (failedUploads.length > 0) {
            throw new BadRequestException(
              `Failed to upload ${failedUploads.length} of ${files.length} image(s). Please try again.`,
            );
          }

          if (successfulUploads.length > 0) {
            await tx.voucherImages.createMany({
              data: successfulUploads.map((r) => ({
                ImageFile: r.filePath,
                ImageFileType: 'jpeg',
                ImageFileSize: r.fileSize ?? null,
                VoucherId: id,
                EvidencedById: userId,
              })),
            });

            added = successfulUploads.length;
          }
        }

        // 3. Update last modified by
        if (added > 0 || deleted > 0) {
          await tx.vouchers.update({
            where: { Id: id },
            data: { LastModifiedById: userId },
          });
        }
      }, { timeout: 30000 });

      // Delete files from FTP after successful transaction
      if (filesToDeleteFromFtp.length > 0) {
        await this.ftpService.deleteMultipleFiles(filesToDeleteFromFtp);
      }

      if (added > 0 || deleted > 0) {
        this.auditService.log({
          entityType: 'Voucher',
          entityId: id,
          action: 'UPDATE_PHOTOS',
          userId,
          changes: { after: { added, deleted } },
        });
      }

      return { added, deleted };
    } catch (error) {
      // Rollback: Clean up newly uploaded files if transaction failed
      if (uploadedFiles.length > 0) {
        await this.ftpService.deleteMultipleFiles(uploadedFiles);
      }
      this.auditService.log({
        entityType: 'Voucher',
        entityId: id,
        action: 'UPDATE_PHOTOS_ERROR',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getPhotos(voucherId: number): Promise<{ id: number; imageFile: string; imageFileType: string | null; imageFileSize: number | null }[]> {
    await this.findOne(voucherId); // Ensure voucher exists
    const photos = await this.prisma.voucherImages.findMany({
      where: { VoucherId: voucherId },
      select: {
        Id: true,
        ImageFile: true,
        ImageFileType: true,
        ImageFileSize: true,
      },
    });
    return photos.map((p) => ({
      id: p.Id,
      imageFile: p.ImageFile,
      imageFileType: p.ImageFileType,
      imageFileSize: p.ImageFileSize,
    }));
  }

  async unarchive(id: number, userId: number): Promise<Vouchers> {
    try {
      await this.findOne(id);

      // Get photos to determine the FTP folder path
      const photos = await this.prisma.voucherImages.findMany({ where: { VoucherId: id } });
      const folderPaths = new Set(
        photos.map((p) => p.ImageFile.substring(0, p.ImageFile.lastIndexOf('/'))),
      );

      // Delete photos and set IsArchived to false in transaction
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.voucherImages.deleteMany({ where: { VoucherId: id } });
        return tx.vouchers.update({
          where: { Id: id },
          data: { IsArchived: false, DateArchived: null, LastModifiedById: userId },
          select: voucherSelectFields,
        });
      });

      // Clean up folders from FTP after successful DB operations
      for (const folder of folderPaths) {
        if (folder) {
          await this.ftpService.deleteDirectory(folder);
        }
      }

      this.auditService.log({
        entityType: 'Voucher',
        entityId: id,
        action: 'UNARCHIVE',
        userId,
      });

      return updated as unknown as Vouchers;
    } catch (error) {
      this.auditService.log({
        entityType: 'Voucher',
        entityId: id,
        action: 'UNARCHIVE_ERROR',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async deleteFromSourcePool(id: number, reason: string, userId: number): Promise<void> {
    const voucher = await this.prisma.vouchers.findUnique({ where: { Id: id } });
    if (!voucher) throw new NotFoundException('Voucher not found');

    // Collect FTP folder paths before deleting from DB
    const photos = await this.prisma.voucherImages.findMany({ where: { VoucherId: id } });
    const folderPaths = new Set(
      photos.map((p) => p.ImageFile.substring(0, p.ImageFile.lastIndexOf('/'))).filter(Boolean),
    );

    await this.prisma.$transaction(async (tx) => {
      // Save a copy of the record to the deletion log before deleting
      await tx.voucherDeletionLog.create({
        data: {
          VoucherNo: voucher.VoucherNo,
          TransactionNo: voucher.TransactionNo ?? null,
          Payee: voucher.Payee,
          Particulars: voucher.Particulars,
          ClaimType: voucher.ClaimType ?? null,
          Amount: voucher.Amount,
          DateDisbursed: voucher.DateDisbursed,
          IsArchived: voucher.IsArchived,
          DeleteReason: reason,
          DeletedById: userId,
        },
      });

      await tx.voucherImages.deleteMany({ where: { VoucherId: id } });
      await tx.vouchers.delete({ where: { Id: id } });
    });

    // Delete FTP folders after successful DB transaction
    for (const folder of folderPaths) {
      await this.ftpService.deleteDirectory(folder);
    }

    await this.auditService.log({
      entityType: 'Voucher',
      entityId: id,
      action: 'delete',
      userId,
    });
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
      try {
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
      } catch (error) {
        this.auditService.log({
          entityType: 'Voucher',
          action: 'BULK_CREATE_ERROR',
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    }

    if (created > 0) {
      this.auditService.log({
        entityType: 'Voucher',
        action: 'BULK_CREATE',
        userId,
        changes: { after: { created, skipped, failed } },
      });
    }

    return { created, skipped, failed, duplicates, errors };
  }

  async composeDocument(
    id: number,
    isBlackAndWhite = false,
    isScanEffect = false,
    imageIds: number[] = [],
    crops?: { imageId: number; left: number; top: number; width: number; height: number }[],
  ): Promise<{
    fileType: string;
    fileSize: number;
    base64: string;
  }> {
    const voucher = await this.prisma.vouchers.findUnique({
      where: { Id: id },
      include: { VoucherImages: true },
    });

    if (!voucher) throw new NotFoundException(`Voucher with ID ${id} not found`);

    // Filter to selected images only
    const selectedImages = imageIds.length > 0
      ? voucher.VoucherImages.filter((img) => imageIds.includes(img.Id))
      : voucher.VoucherImages;

    if (selectedImages.length === 0) {
      throw new BadRequestException('No images found for the selected IDs');
    }

    // Download selected images from FTP
    const filePaths = selectedImages.map((img) => img.ImageFile);
    const downloadedFiles = await this.ftpService.downloadMultipleFiles(filePaths);

    // Build crop map keyed by imageId
    const cropMap = new Map<number, { left: number; top: number; width: number; height: number }>();
    if (crops) {
      for (const crop of crops) {
        cropMap.set(crop.imageId, { left: crop.left, top: crop.top, width: crop.width, height: crop.height });
      }
    }

    const imageEntries: { buffer: Buffer; crop?: { left: number; top: number; width: number; height: number } }[] = [];
    for (const img of selectedImages) {
      const buffer = downloadedFiles.get(img.ImageFile);
      if (buffer) {
        imageEntries.push({ buffer, crop: cropMap.get(img.Id) });
      }
    }

    if (imageEntries.length === 0) {
      throw new BadRequestException('Failed to download images for PDF composition');
    }

    // Compose into PDF (no FTP save, just return for printing)
    const pdfBuffer = await this.ftpService.composeToPdf(imageEntries, isBlackAndWhite, isScanEffect);
    const base64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

    return {
      fileType: 'pdf',
      fileSize: pdfBuffer.length,
      base64,
    };
  }

  async archive(id: number, userId: number, files?: Express.Multer.File[]): Promise<Vouchers> {
    const voucher = await this.findOne(id);

    if (voucher.IsArchived) {
      throw new BadRequestException('Voucher is already archived');
    }

    if (files && files.length > 0) {
      await this.validateImageFiles(files);
    }

    const uploadedFiles: { filePath: string; fileSize: number }[] = [];

    try {
      // 1. DB + FTP in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Re-check inside transaction to prevent race condition
        const current = await tx.vouchers.findUnique({ where: { Id: id } });
        if (current?.IsArchived) {
          throw new BadRequestException('Voucher is already archived');
        }

        const updated = await tx.vouchers.update({
          where: { Id: id },
          data: { IsArchived: true, DateArchived: new Date(), LastModifiedById: userId },
        });

        // 2. Upload files inside transaction
        if (files && files.length > 0) {
          const uploadResults = await this.ftpService.uploadMultipleVoucherFiles(files, 'vouchers', {
            voucherNo: voucher.VoucherNo,
            date: voucher.DateDisbursed,
          });

          const successfulUploads = uploadResults.filter((r) => r.success);
          const failedUploads = uploadResults.filter((r) => !r.success);
          uploadedFiles.push(...successfulUploads.map((r) => ({ filePath: r.filePath, fileSize: r.fileSize ?? 0 })));

          // Rollback if any uploads failed
          if (failedUploads.length > 0) {
            throw new BadRequestException(
              `Failed to upload ${failedUploads.length} of ${files.length} image(s). Please try again.`,
            );
          }

          if (successfulUploads.length > 0) {
            await tx.voucherImages.createMany({
              data: successfulUploads.map((r) => ({
                ImageFile: r.filePath,
                ImageFileType: 'jpeg',
                ImageFileSize: r.fileSize ?? 0,
                VoucherId: id,
                EvidencedById: userId,
              })),
            });
          }
        }

        return updated;
      }, { timeout: 30000 });

      this.auditService.log({
        entityType: 'Voucher',
        entityId: id,
        action: 'ARCHIVE',
        userId,
      });

      return this.findOne(result.Id);
    } catch (error) {
      // Rollback: Clean up uploaded files if transaction failed
      if (uploadedFiles.length > 0) {
        await this.ftpService.deleteMultipleFiles(uploadedFiles.map((f) => f.filePath));
      }
      this.auditService.log({
        entityType: 'Voucher',
        entityId: id,
        action: 'ARCHIVE_ERROR',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
