import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateIndexDocumentDto } from './dto/create-index-document.dto';
import { UpdateIndexDocumentDto } from './dto/update-index-document.dto';
import { IndexDocumentQueryDto } from './dto/index-document-query.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { IndexDocument } from '@prisma/client';

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
};

@Injectable()
export class IndexDocumentService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(query: IndexDocumentQueryDto): Promise<PaginatedResult<IndexDocument>> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.payee) {
      where.Payee = { contains: query.payee };
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

  async create(dto: CreateIndexDocumentDto, userId: number) {
    const document = await this.prisma.indexDocument.create({
      data: {
        Payee: dto.Payee,
        Particulars: dto.Particulars,
        period_start: new Date(dto.PeriodStart),
        period_end: new Date(dto.PeriodEnd),
        AddedById: userId,
      },
      select: selectFields,
    });

    this.auditService.log({
      entityType: 'IndexDocument',
      entityId: document.Id,
      action: 'CREATE',
      userId,
      changes: { after: document },
    });

    return document;
  }

  async update(id: number, dto: UpdateIndexDocumentDto, userId: number) {
    const before = await this.findOne(id);

    const updateData: Record<string, unknown> = {};
    if (dto.Payee !== undefined) updateData.Payee = dto.Payee;
    if (dto.Particulars !== undefined) updateData.Particulars = dto.Particulars;
    if (dto.PeriodStart !== undefined) updateData.period_start = new Date(dto.PeriodStart);
    if (dto.PeriodEnd !== undefined) updateData.period_end = new Date(dto.PeriodEnd);
    updateData.LastModifiedById = userId;

    const updated = await this.prisma.indexDocument.update({
      where: { Id: id },
      data: updateData,
      select: selectFields,
    });

    this.auditService.log({
      entityType: 'IndexDocument',
      entityId: id,
      action: 'UPDATE',
      userId,
      changes: { before, after: updated },
    });

    return updated;
  }

  async remove(id: number, userId: number) {
    const document = await this.findOne(id);
    await this.prisma.indexDocument.delete({ where: { Id: id } });

    this.auditService.log({
      entityType: 'IndexDocument',
      entityId: id,
      action: 'DELETE',
      userId,
      changes: { before: document },
    });

    return document;
  }
}
