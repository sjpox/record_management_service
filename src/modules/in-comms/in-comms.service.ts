import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FtpService } from '../../common/services/ftp.service';
import { CreateInCommDto } from './dto/create-in-comm.dto';
import { UpdateInCommDto } from './dto/update-in-comm.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { InComms } from '@prisma/client';

@Injectable()
export class InCommsService {
  constructor(
    private prisma: PrismaService,
    private ftpService: FtpService,
  ) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<InComms>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.inComms.findMany({
        skip,
        take: limit,
        include: { DocOrigin: true, OthInPhotos: true },
      }),
      this.prisma.inComms.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<InComms> {
    const item = await this.prisma.inComms.findUnique({
      where: { Id: id },
      include: { DocOrigin: true, OthInPhotos: true },
    });
    if (!item) throw new NotFoundException(`InComm with ID ${id} not found`);
    return item;
  }

  async search(searchTerm: string): Promise<InComms[]> {
    return this.prisma.inComms.findMany({
      where: { Particulars: { contains: searchTerm } },
      include: { DocOrigin: true, OthInPhotos: true },
    });
  }

  async create(dto: CreateInCommDto, files?: Express.Multer.File[]): Promise<InComms> {
    const uploadedFiles: string[] = [];

    try {
      // Start transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Insert inComm data
        const inComm = await tx.inComms.create({
          data: {
            ...dto,
            DocOrigin_Id: dto.DocOrigin_Id,
          },
        });

        // 2. Process and upload files
        if (files && files.length > 0) {
          const uploadResults = await this.ftpService.uploadMultipleVoucherFiles(files, 'in-comms', {
            voucherNo: inComm.Id.toString(),
            date: inComm.DateReceived ? new Date(inComm.DateReceived) : new Date(),
          });

          const successfulUploads = uploadResults
            .filter((r) => r.success)
            .map((r) => r.filePath);

          // Track uploaded files for potential cleanup
          uploadedFiles.push(...successfulUploads);

          // 3. Insert photo records
          if (successfulUploads.length > 0) {
            await tx.othInPhotos.createMany({
              data: successfulUploads.map((filePath) => ({
                ImageFile: filePath,
                InComm_Id: inComm.Id,
              })),
            });
          }
        }

        return inComm;
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

  async update(id: number, dto: UpdateInCommDto): Promise<InComms> {
    await this.findOne(id);
    return this.prisma.inComms.update({
      where: { Id: id },
      data: dto,
      include: { DocOrigin: true, OthInPhotos: true },
    });
  }

  async addPhotos(id: number, files: Express.Multer.File[]): Promise<{ count: number }> {
    const inComm = await this.findOne(id);
    const uploadedFiles: string[] = [];

    try {
      // Upload files first
      const uploadResults = await this.ftpService.uploadMultipleVoucherFiles(files, 'in-comms', {
        voucherNo: inComm.Id.toString(),
        date: inComm.DateReceived ? new Date(inComm.DateReceived) : new Date(),
      });

      const successfulUploads = uploadResults
        .filter((r) => r.success)
        .map((r) => r.filePath);

      uploadedFiles.push(...successfulUploads);

      // Insert photo records in transaction
      if (successfulUploads.length > 0) {
        await this.prisma.$transaction(async (tx) => {
          await tx.othInPhotos.createMany({
            data: successfulUploads.map((filePath) => ({
              ImageFile: filePath,
              InComm_Id: id,
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
    const photo = await this.prisma.othInPhotos.findUnique({ where: { In_Id: photoId } });
    if (!photo) throw new NotFoundException(`Photo with ID ${photoId} not found`);

    // Delete from DB first, then from FTP
    await this.prisma.othInPhotos.delete({ where: { In_Id: photoId } });
    await this.ftpService.deleteFile(photo.ImageFile);
  }

  async remove(id: number): Promise<InComms> {
    await this.findOne(id);

    // Get photos for cleanup
    const photos = await this.prisma.othInPhotos.findMany({ where: { InComm_Id: id } });
    const filePaths = photos.map((p) => p.ImageFile);

    // Delete from DB in transaction
    const deleted = await this.prisma.$transaction(async (tx) => {
      await tx.othInPhotos.deleteMany({ where: { InComm_Id: id } });
      return tx.inComms.delete({ where: { Id: id } });
    });

    // Clean up files from FTP after successful DB deletion
    if (filePaths.length > 0) {
      await this.ftpService.deleteMultipleFiles(filePaths);
    }

    return deleted;
  }
}
