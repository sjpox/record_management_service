import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FtpService } from '../../common/services/ftp.service';
import { AuditService } from '../audit/audit.service';
import { CreateOtherDocumentDto } from './dto/create-other-document.dto';
import { UpdateOtherDocumentDto } from './dto/update-other-document.dto';
import { OtherDocumentQueryDto } from './dto/other-document-query.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { OtherDocument } from '@prisma/client';
import sharp from 'sharp';

const selectFields = {
  Id: true,
  DocumentNo: true,
  Title: true,
  Particulars: true,
  DateArchived: true,
  DateLastUpdated: true,
  AddedById: true,
  LastModifiedById: true,
  ShelfItemId: true,
  AddedBy: { select: { Id: true, FirstName: true, LastName: true } },
  LastModifiedBy: { select: { Id: true, FirstName: true, LastName: true } },
  ShelfItem: {
    select: {
      Id: true,
      Label: true,
      Category: true,
      Shelf: {
        select: {
          Id: true,
          Name: true,
          Cabinet: {
            select: {
              Id: true,
              Name: true,
              Building: { select: { Id: true, Name: true } },
              Floor: { select: { Id: true, Name: true } },
              Room: { select: { Id: true, Name: true } },
            },
          },
        },
      },
    },
  },
  _count: {
    select: {
      DocumentImages: true,
    },
  },
};

@Injectable()
export class OtherDocumentService {
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

  async findAll(query: OtherDocumentQueryDto): Promise<PaginatedResult<OtherDocument>> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.title) {
      where.Title = { contains: query.title };
    }

    if (query.search) {
      where.OR = [
        { DocumentNo: { contains: query.search } },
        { Title: { contains: query.search } },
        { Particulars: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.otherDocument.findMany({
        skip,
        take: limit,
        where,
        select: selectFields,
        orderBy: { DateArchived: 'desc' },
      }),
      this.prisma.otherDocument.count({ where }),
    ]);

    return {
      data: data as unknown as OtherDocument[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const document = await this.prisma.otherDocument.findUnique({
      where: { Id: id },
      select: selectFields,
    });
    if (!document) throw new NotFoundException(`Other document with ID ${id} not found`);
    return document;
  }

  async findOneWithPhotos(id: number) {
    const document = await this.prisma.otherDocument.findUnique({
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

    if (!document) throw new NotFoundException(`Other document with ID ${id} not found`);

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

  async create(dto: CreateOtherDocumentDto, userId: number, files?: Express.Multer.File[]) {
    if (files && files.length > 0) {
      await this.validateImageFiles(files);
    }

    const uploadedFiles: string[] = [];

    try {
      const document = await this.prisma.$transaction(async (tx) => {
        const year = new Date().getFullYear();
        const count = await tx.otherDocument.count({
          where: { DocumentNo: { startsWith: `OD-${year}-` } },
        });
        const documentNo = `OD-${year}-${String(count + 1).padStart(4, '0')}`;

        const created = await tx.otherDocument.create({
          data: {
            DocumentNo: documentNo,
            Title: dto.Title,
            Particulars: dto.Particulars,
            AddedById: userId,
            ShelfItemId: dto.ShelfItemId ?? null,
          },
        });

        if (files && files.length > 0) {
          const uploadResults = await this.ftpService.uploadOtherDocumentFiles(files, dto.Title);

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
                OtherDocumentId: created.Id,
                EvidencedById: userId,
              })),
            });
          }
        }

        return created;
      }, { timeout: 30000 });

      const result = await this.findOne(document.Id);

      this.auditService.log({
        entityType: 'OtherDocument',
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
        entityType: 'OtherDocument',
        action: 'CREATE_ERROR',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async update(id: number, dto: UpdateOtherDocumentDto, userId: number) {
    try {
      const updateData: Record<string, unknown> = {};
      if (dto.Title !== undefined) updateData.Title = dto.Title;
      if (dto.Particulars !== undefined) updateData.Particulars = dto.Particulars;
      if (dto.ShelfItemId !== undefined) updateData.ShelfItemId = dto.ShelfItemId ?? null;
      updateData.LastModifiedById = userId;

      const { before, updated } = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.otherDocument.findUnique({
          where: { Id: id },
          select: selectFields,
        });
        if (!existing) throw new NotFoundException(`Other document with ID ${id} not found`);

        const result = await tx.otherDocument.update({
          where: { Id: id },
          data: updateData,
          select: selectFields,
        });

        return { before: existing, updated: result };
      });

      this.auditService.log({
        entityType: 'OtherDocument',
        entityId: id,
        action: 'UPDATE',
        userId,
        changes: { before, after: updated },
      });

      return updated;
    } catch (error) {
      this.auditService.log({
        entityType: 'OtherDocument',
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
              OtherDocumentId: id,
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
          const uploadResults = await this.ftpService.uploadOtherDocumentFiles(files, document.Title);

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
                OtherDocumentId: id,
                EvidencedById: userId,
              })),
            });

            added = successfulUploads.length;
          }
        }

        if (added > 0 || deleted > 0) {
          await tx.otherDocument.update({
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
          entityType: 'OtherDocument',
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
        entityType: 'OtherDocument',
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
      where: { OtherDocumentId: id },
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
        const existing = await tx.otherDocument.findUnique({
          where: { Id: id },
          select: selectFields,
        });
        if (!existing) throw new NotFoundException(`Other document with ID ${id} not found`);

        const photos = await tx.documentImages.findMany({
          where: { OtherDocumentId: id },
        });
        const folders = new Set(
          photos.map((p) => p.ImageFile.substring(0, p.ImageFile.lastIndexOf('/'))),
        );

        await tx.documentImages.deleteMany({ where: { OtherDocumentId: id } });
        await tx.otherDocument.delete({ where: { Id: id } });

        return { document: existing, folderPaths: folders };
      });

      for (const folder of folderPaths) {
        if (folder) {
          await this.ftpService.deleteDirectory(folder);
        }
      }

      this.auditService.log({
        entityType: 'OtherDocument',
        entityId: id,
        action: 'DELETE',
        userId,
        changes: { before: document },
      });

      return document;
    } catch (error) {
      this.auditService.log({
        entityType: 'OtherDocument',
        entityId: id,
        action: 'DELETE_ERROR',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
