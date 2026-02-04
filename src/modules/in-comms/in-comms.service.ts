import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FtpService } from '../../common/services/ftp.service';
import { CreateInCommDto } from './dto/create-in-comm.dto';
import { UpdateInCommDto } from './dto/update-in-comm.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { InComms } from '.prisma/client/client';

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
    const inComm = await this.prisma.inComms.create({
      data: {
        ...dto,
        DocOrigin_Id: dto.DocOrigin_Id,
      },
    });

    if (files && files.length > 0) {
      const subDir = `in-comms/${inComm.Id}`;
      const uploadResults = await this.ftpService.uploadMultipleFiles(files, subDir);

      const successfulUploads = uploadResults
        .filter((r) => r.success)
        .map((r) => r.filePath);

      if (successfulUploads.length > 0) {
        await this.prisma.othInPhotos.createMany({
          data: successfulUploads.map((filePath) => ({
            ImageFile: filePath,
            InComm_Id: inComm.Id,
          })),
        });
      }
    }

    return this.findOne(inComm.Id);
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
    await this.findOne(id);

    const subDir = `in-comms/${id}`;
    const uploadResults = await this.ftpService.uploadMultipleFiles(files, subDir);

    const successfulUploads = uploadResults
      .filter((r) => r.success)
      .map((r) => r.filePath);

    if (successfulUploads.length > 0) {
      await this.prisma.othInPhotos.createMany({
        data: successfulUploads.map((filePath) => ({
          ImageFile: filePath,
          InComm_Id: id,
        })),
      });
    }

    return { count: successfulUploads.length };
  }

  async deletePhoto(photoId: number): Promise<void> {
    const photo = await this.prisma.othInPhotos.findUnique({ where: { In_Id: photoId } });
    if (!photo) throw new NotFoundException(`Photo with ID ${photoId} not found`);

    await this.ftpService.deleteFile(photo.ImageFile);
    await this.prisma.othInPhotos.delete({ where: { In_Id: photoId } });
  }

  async remove(id: number): Promise<InComms> {
    const inComm = await this.findOne(id);

    // Delete photos from FTP
    const photos = await this.prisma.othInPhotos.findMany({ where: { InComm_Id: id } });
    for (const photo of photos) {
      await this.ftpService.deleteFile(photo.ImageFile);
    }

    // Delete photos from DB
    await this.prisma.othInPhotos.deleteMany({ where: { InComm_Id: id } });

    // Delete inComm
    return this.prisma.inComms.delete({ where: { Id: id } });
  }
}
