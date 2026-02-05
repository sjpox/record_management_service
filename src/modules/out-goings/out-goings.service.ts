import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FtpService } from '../../common/services/ftp.service';
import { CreateOutGoingDto } from './dto/create-out-going.dto';
import { UpdateOutGoingDto } from './dto/update-out-going.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { OutGoings } from '@prisma/client';

@Injectable()
export class OutGoingsService {
  constructor(
    private prisma: PrismaService,
    private ftpService: FtpService,
  ) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<OutGoings>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.outGoings.findMany({
        skip,
        take: limit,
        include: { ResponPerson: true, OthOutPhotos: true },
      }),
      this.prisma.outGoings.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<OutGoings> {
    const item = await this.prisma.outGoings.findUnique({
      where: { Id: id },
      include: { ResponPerson: true, OthOutPhotos: true },
    });
    if (!item) throw new NotFoundException(`OutGoing with ID ${id} not found`);
    return item;
  }

  async search(searchTerm: string): Promise<OutGoings[]> {
    return this.prisma.outGoings.findMany({
      where: { Particulars: { contains: searchTerm } },
      include: { ResponPerson: true, OthOutPhotos: true },
    });
  }

  async create(dto: CreateOutGoingDto, files?: Express.Multer.File[]): Promise<OutGoings> {
    const uploadedFiles: string[] = [];

    try {
      // Start transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Insert outGoing data
        const outGoing = await tx.outGoings.create({
          data: {
            ...dto,
            ResponPerson_Id: dto.ResponPerson_Id,
          },
        });

        // 2. Process and upload files
        if (files && files.length > 0) {
          const uploadResults = await this.ftpService.uploadMultipleVoucherFiles(files, 'out-goings', {
            voucherNo: outGoing.Id.toString(),
            date: outGoing.DatePrepared ? new Date(outGoing.DatePrepared) : new Date(),
          });

          const successfulUploads = uploadResults
            .filter((r) => r.success)
            .map((r) => r.filePath);

          // Track uploaded files for potential cleanup
          uploadedFiles.push(...successfulUploads);

          // 3. Insert photo records
          if (successfulUploads.length > 0) {
            await tx.othOutPhotos.createMany({
              data: successfulUploads.map((filePath) => ({
                ImageFile: filePath,
                OutGoing_Id: outGoing.Id,
              })),
            });
          }
        }

        return outGoing;
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

  async update(id: number, dto: UpdateOutGoingDto): Promise<OutGoings> {
    await this.findOne(id);
    return this.prisma.outGoings.update({
      where: { Id: id },
      data: dto,
      include: { ResponPerson: true, OthOutPhotos: true },
    });
  }

  async addPhotos(id: number, files: Express.Multer.File[]): Promise<{ count: number }> {
    const outGoing = await this.findOne(id);
    const uploadedFiles: string[] = [];

    try {
      // Upload files first
      const uploadResults = await this.ftpService.uploadMultipleVoucherFiles(files, 'out-goings', {
        voucherNo: outGoing.Id.toString(),
        date: outGoing.DatePrepared ? new Date(outGoing.DatePrepared) : new Date(),
      });

      const successfulUploads = uploadResults
        .filter((r) => r.success)
        .map((r) => r.filePath);

      uploadedFiles.push(...successfulUploads);

      // Insert photo records in transaction
      if (successfulUploads.length > 0) {
        await this.prisma.$transaction(async (tx) => {
          await tx.othOutPhotos.createMany({
            data: successfulUploads.map((filePath) => ({
              ImageFile: filePath,
              OutGoing_Id: id,
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
    const photo = await this.prisma.othOutPhotos.findUnique({ where: { Out_Id: photoId } });
    if (!photo) throw new NotFoundException(`Photo with ID ${photoId} not found`);

    // Delete from DB first, then from FTP
    await this.prisma.othOutPhotos.delete({ where: { Out_Id: photoId } });
    await this.ftpService.deleteFile(photo.ImageFile);
  }

  async remove(id: number): Promise<OutGoings> {
    await this.findOne(id);

    // Get photos for cleanup
    const photos = await this.prisma.othOutPhotos.findMany({ where: { OutGoing_Id: id } });
    const filePaths = photos.map((p) => p.ImageFile);

    // Delete from DB in transaction
    const deleted = await this.prisma.$transaction(async (tx) => {
      await tx.othOutPhotos.deleteMany({ where: { OutGoing_Id: id } });
      return tx.outGoings.delete({ where: { Id: id } });
    });

    // Clean up files from FTP after successful DB deletion
    if (filePaths.length > 0) {
      await this.ftpService.deleteMultipleFiles(filePaths);
    }

    return deleted;
  }
}
