import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FtpService } from '../../common/services/ftp.service';
import { CreateOutGoingDto } from './dto/create-out-going.dto';
import { UpdateOutGoingDto } from './dto/update-out-going.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { OutGoings } from '.prisma/client/client';

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
    const outGoing = await this.prisma.outGoings.create({
      data: {
        ...dto,
        ResponPerson_Id: dto.ResponPerson_Id,
      },
    });

    if (files && files.length > 0) {
      const subDir = `out-goings/${outGoing.Id}`;
      const uploadResults = await this.ftpService.uploadMultipleFiles(files, subDir);

      const successfulUploads = uploadResults
        .filter((r) => r.success)
        .map((r) => r.filePath);

      if (successfulUploads.length > 0) {
        await this.prisma.othOutPhotos.createMany({
          data: successfulUploads.map((filePath) => ({
            ImageFile: filePath,
            OutGoing_Id: outGoing.Id,
          })),
        });
      }
    }

    return this.findOne(outGoing.Id);
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
    await this.findOne(id);

    const subDir = `out-goings/${id}`;
    const uploadResults = await this.ftpService.uploadMultipleFiles(files, subDir);

    const successfulUploads = uploadResults
      .filter((r) => r.success)
      .map((r) => r.filePath);

    if (successfulUploads.length > 0) {
      await this.prisma.othOutPhotos.createMany({
        data: successfulUploads.map((filePath) => ({
          ImageFile: filePath,
          OutGoing_Id: id,
        })),
      });
    }

    return { count: successfulUploads.length };
  }

  async deletePhoto(photoId: number): Promise<void> {
    const photo = await this.prisma.othOutPhotos.findUnique({ where: { Out_Id: photoId } });
    if (!photo) throw new NotFoundException(`Photo with ID ${photoId} not found`);

    await this.ftpService.deleteFile(photo.ImageFile);
    await this.prisma.othOutPhotos.delete({ where: { Out_Id: photoId } });
  }

  async remove(id: number): Promise<OutGoings> {
    const outGoing = await this.findOne(id);

    // Delete photos from FTP
    const photos = await this.prisma.othOutPhotos.findMany({ where: { OutGoing_Id: id } });
    for (const photo of photos) {
      await this.ftpService.deleteFile(photo.ImageFile);
    }

    // Delete photos from DB
    await this.prisma.othOutPhotos.deleteMany({ where: { OutGoing_Id: id } });

    // Delete outGoing
    return this.prisma.outGoings.delete({ where: { Id: id } });
  }
}
