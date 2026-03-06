import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FtpService } from '../../common/services/ftp.service';
import { AuditService } from '../audit/audit.service';
import { CreateIndexDocumentDto } from './dto/create-index-document.dto';
import { UpdateIndexDocumentDto } from './dto/update-index-document.dto';
import { IndexDocumentQueryDto } from './dto/index-document-query.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { IndexDocument } from '@prisma/client';
import sharp from 'sharp';

const selectFields = {
  Id: true,
  Payee: true,
  Particulars: true,
  period_start: true,
  period_end: true,
  DateArchived: true,
  DateLastUpdated: true,
  AddedById: true,
  LastModifiedById: true,
  AddedBy: { select: { Id: true, FirstName: true, LastName: true } },
  LastModifiedBy: { select: { Id: true, FirstName: true, LastName: true } },
  _count: {
    select: {
      DocumentImages: true,
    },
  },
};

@Injectable()
export class IndexDocumentService {
  constructor(
    private prisma: PrismaService,
    private ftpService: FtpService,
    private auditService: AuditService,
  ) {}

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

  async findAll(query: IndexDocumentQueryDto): Promise<PaginatedResult<IndexDocument>> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.payee) {
      where.Payee = { contains: query.payee };
    }

    if (query.periodFrom) {
      where.period_start = { ...(where.period_start as object), gte: new Date(query.periodFrom) };
    }

    if (query.periodTo) {
      where.period_end = { ...(where.period_end as object), lte: new Date(query.periodTo) };
    }

    if (query.search) {
      where.OR = [
        { Payee: { contains: query.search } },
        { Particulars: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.indexDocument.findMany({
        skip,
        take: limit,
        where,
        select: selectFields,
        orderBy: { DateArchived: 'desc' },
      }),
      this.prisma.indexDocument.count({ where }),
    ]);

    return {
      data: data as unknown as IndexDocument[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const document = await this.prisma.indexDocument.findUnique({
      where: { Id: id },
      select: selectFields,
    });
    if (!document) throw new NotFoundException(`Index document with ID ${id} not found`);
    return document;
  }

  async findOneWithPhotos(id: number) {
    const document = await this.prisma.indexDocument.findUnique({
      where: { Id: id },
      select: {
        ...selectFields,
        DocumentImages: {
          select: {
            Id: true,
            ImageFile: true,
            ImageFileType: true,
            ImageFileSize: true,
          },
        },
      },
    });

    if (!document) throw new NotFoundException(`Index document with ID ${id} not found`);

    const { DocumentImages, ...documentData } = document;

    const filePaths = DocumentImages.map((p) => p.ImageFile);
    const downloadedFiles = await this.ftpService.downloadMultipleFiles(filePaths);

    const photos = DocumentImages.map((photo) => {
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
    });

    const ftpFileCount = filePaths.filter((fp) => downloadedFiles.get(fp) !== null).length;

    return {
      document: documentData,
      photoCount: DocumentImages.length,
      ftpFileCount,
      photos,
    };
  }

  async create(dto: CreateIndexDocumentDto, userId: number, files?: Express.Multer.File[]) {
    if (files && files.length > 0) {
      await this.validateImageFiles(files);
    }

    const uploadedFiles: string[] = [];

    try {
      const document = await this.prisma.$transaction(async (tx) => {
        const created = await tx.indexDocument.create({
          data: {
            Payee: dto.Payee,
            Particulars: dto.Particulars,
            period_start: new Date(dto.PeriodStart),
            period_end: new Date(dto.PeriodEnd),
            AddedById: userId,
          },
        });

        if (files && files.length > 0) {
          const uploadResults = await this.ftpService.uploadIndexDocumentFiles(files, {
            payee: dto.Payee,
            periodStart: new Date(dto.PeriodStart),
            periodEnd: new Date(dto.PeriodEnd),
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
            await tx.documentImages.createMany({
              data: successfulUploads.map((r) => ({
                ImageFile: r.filePath,
                ImageFileType: 'jpeg',
                ImageFileSize: r.fileSize ?? null,
                IndexDocumentId: created.Id,
                EvidencedById: userId,
              })),
            });
          }
        }

        return created;
      }, { timeout: 30000 });

      const result = await this.findOne(document.Id);

      this.auditService.log({
        entityType: 'IndexDocument',
        entityId: document.Id,
        action: 'CREATE',
        userId,
        changes: { after: result },
      });

      return result;
    } catch (error) {
      if (uploadedFiles.length > 0) {
        await this.ftpService.deleteMultipleFiles(uploadedFiles);
      }
      this.auditService.log({
        entityType: 'IndexDocument',
        action: 'CREATE_ERROR',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async update(id: number, dto: UpdateIndexDocumentDto, userId: number) {
    try {
      const updateData: Record<string, unknown> = {};
      if (dto.Payee !== undefined) updateData.Payee = dto.Payee;
      if (dto.Particulars !== undefined) updateData.Particulars = dto.Particulars;
      if (dto.PeriodStart !== undefined) updateData.period_start = new Date(dto.PeriodStart);
      if (dto.PeriodEnd !== undefined) updateData.period_end = new Date(dto.PeriodEnd);
      updateData.LastModifiedById = userId;

      const { before, updated } = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.indexDocument.findUnique({
          where: { Id: id },
          select: selectFields,
        });
        if (!existing) throw new NotFoundException(`Index document with ID ${id} not found`);

        const result = await tx.indexDocument.update({
          where: { Id: id },
          data: updateData,
          select: selectFields,
        });

        return { before: existing, updated: result };
      });

      this.auditService.log({
        entityType: 'IndexDocument',
        entityId: id,
        action: 'UPDATE',
        userId,
        changes: { before, after: updated },
      });

      return updated;
    } catch (error) {
      this.auditService.log({
        entityType: 'IndexDocument',
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
    const document = await this.findOne(id);

    if (files && files.length > 0) {
      await this.validateImageFiles(files);
    }

    let added = 0;
    let deleted = 0;
    const uploadedFiles: string[] = [];
    const filesToDeleteFromFtp: string[] = [];

    try {
      await this.prisma.$transaction(async (tx) => {
        if (deletePhotoIds && deletePhotoIds.length > 0) {
          const photosToDelete = await tx.documentImages.findMany({
            where: {
              Id: { in: deletePhotoIds },
              IndexDocumentId: id,
            },
          });

          if (photosToDelete.length > 0) {
            filesToDeleteFromFtp.push(...photosToDelete.map((p) => p.ImageFile));

            await tx.documentImages.deleteMany({
              where: { Id: { in: photosToDelete.map((p) => p.Id) } },
            });

            deleted = photosToDelete.length;
          }
        }

        if (files && files.length > 0) {
          const uploadResults = await this.ftpService.uploadIndexDocumentFiles(files, {
            payee: document.Payee,
            periodStart: document.period_start,
            periodEnd: document.period_end,
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
            await tx.documentImages.createMany({
              data: successfulUploads.map((r) => ({
                ImageFile: r.filePath,
                ImageFileType: 'jpeg',
                ImageFileSize: r.fileSize ?? null,
                IndexDocumentId: id,
                EvidencedById: userId,
              })),
            });

            added = successfulUploads.length;
          }
        }

        if (added > 0 || deleted > 0) {
          await tx.indexDocument.update({
            where: { Id: id },
            data: { LastModifiedById: userId },
          });
        }
      }, { timeout: 30000 });

      if (filesToDeleteFromFtp.length > 0) {
        await this.ftpService.deleteMultipleFiles(filesToDeleteFromFtp);
      }

      if (added > 0 || deleted > 0) {
        this.auditService.log({
          entityType: 'IndexDocument',
          entityId: id,
          action: 'UPDATE_PHOTOS',
          userId,
          changes: { after: { added, deleted } },
        });
      }

      return { added, deleted };
    } catch (error) {
      if (uploadedFiles.length > 0) {
        await this.ftpService.deleteMultipleFiles(uploadedFiles);
      }
      this.auditService.log({
        entityType: 'IndexDocument',
        entityId: id,
        action: 'UPDATE_PHOTOS_ERROR',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getPhotos(id: number) {
    await this.findOne(id);
    const photos = await this.prisma.documentImages.findMany({
      where: { IndexDocumentId: id },
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

  async remove(id: number, userId: number) {
    try {
      const { document, folderPaths } = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.indexDocument.findUnique({
          where: { Id: id },
          select: selectFields,
        });
        if (!existing) throw new NotFoundException(`Index document with ID ${id} not found`);

        const photos = await tx.documentImages.findMany({
          where: { IndexDocumentId: id },
        });
        const folders = new Set(
          photos.map((p) => p.ImageFile.substring(0, p.ImageFile.lastIndexOf('/'))),
        );

        await tx.documentImages.deleteMany({ where: { IndexDocumentId: id } });
        await tx.indexDocument.delete({ where: { Id: id } });

        return { document: existing, folderPaths: folders };
      });

      for (const folder of folderPaths) {
        if (folder) {
          await this.ftpService.deleteDirectory(folder);
        }
      }

      this.auditService.log({
        entityType: 'IndexDocument',
        entityId: id,
        action: 'DELETE',
        userId,
        changes: { before: document },
      });

      return document;
    } catch (error) {
      this.auditService.log({
        entityType: 'IndexDocument',
        entityId: id,
        action: 'DELETE_ERROR',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
