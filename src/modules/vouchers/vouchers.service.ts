import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FtpService } from '../../common/services/ftp.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { Vouchers } from '.prisma/client/client';

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
    const voucher = await this.prisma.vouchers.create({
      data: {
        ...dto,
        Amount: dto.Amount,
        DateReleased: dto.DateReleased ? new Date(dto.DateReleased) : undefined,
      },
    });

    if (files && files.length > 0) {
      const subDir = `vouchers/${voucher.Id}`;
      const uploadResults = await this.ftpService.uploadMultipleFiles(files, subDir);

      const successfulUploads = uploadResults
        .filter((r) => r.success)
        .map((r) => r.filePath);

      if (successfulUploads.length > 0) {
        await this.prisma.vouPhotos.createMany({
          data: successfulUploads.map((filePath) => ({
            ImageFile: filePath,
            Voucher_Id: voucher.Id,
          })),
        });
      }
    }

    return this.findOne(voucher.Id);
  }

  async update(id: number, dto: UpdateVoucherDto): Promise<Vouchers> {
    await this.findOne(id);
    const { DateReleased, ...rest } = dto;
    return this.prisma.vouchers.update({
      where: { Id: id },
      data: {
        ...rest,
        DateReleased: DateReleased ? new Date(DateReleased) : undefined,
      },
      include: { VouPhotos: true },
    });
  }

  async addPhotos(id: number, files: Express.Multer.File[]): Promise<{ count: number }> {
    await this.findOne(id);

    const subDir = `vouchers/${id}`;
    const uploadResults = await this.ftpService.uploadMultipleFiles(files, subDir);

    const successfulUploads = uploadResults
      .filter((r) => r.success)
      .map((r) => r.filePath);

    if (successfulUploads.length > 0) {
      await this.prisma.vouPhotos.createMany({
        data: successfulUploads.map((filePath) => ({
          ImageFile: filePath,
          Voucher_Id: id,
        })),
      });
    }

    return { count: successfulUploads.length };
  }

  async deletePhoto(photoId: number): Promise<void> {
    const photo = await this.prisma.vouPhotos.findUnique({ where: { Vou_Id: photoId } });
    if (!photo) throw new NotFoundException(`Photo with ID ${photoId} not found`);

    await this.ftpService.deleteFile(photo.ImageFile);
    await this.prisma.vouPhotos.delete({ where: { Vou_Id: photoId } });
  }

  async remove(id: number): Promise<Vouchers> {
    const voucher = await this.findOne(id);

    // Delete photos from FTP
    const photos = await this.prisma.vouPhotos.findMany({ where: { Voucher_Id: id } });
    for (const photo of photos) {
      await this.ftpService.deleteFile(photo.ImageFile);
    }

    // Delete photos from DB
    await this.prisma.vouPhotos.deleteMany({ where: { Voucher_Id: id } });

    // Delete voucher
    return this.prisma.vouchers.delete({ where: { Id: id } });
  }
}
