import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { Users } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Fields to select (excluding PasswordHash)
const userSelectFields = {
  Id: true,
  FirstName: true,
  LastName: true,
  EmployeeId: true,
  Section: true,
  Role: true,
  MobileNo: true,
  Email: true,
  IsActive: true,
  DateAdded: true,
  LastLogin: true,
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<Omit<Users, 'PasswordHash'>>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.users.findMany({
        skip,
        take: limit,
        select: userSelectFields,
      }),
      this.prisma.users.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Omit<Users, 'PasswordHash'>> {
    const user = await this.prisma.users.findUnique({
      where: { Id: id },
      select: userSelectFields,
    });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async findByEmployeeId(employeeId: string): Promise<Users | null> {
    return this.prisma.users.findFirst({
      where: { EmployeeId: employeeId },
    });
  }

  async create(dto: CreateUserDto): Promise<Omit<Users, 'PasswordHash'>> {
    // Check if employee ID already exists
    const existing = await this.findByEmployeeId(dto.EmployeeId);
    if (existing) {
      throw new ConflictException(`Employee ID ${dto.EmployeeId} already exists`);
    }

    const hashedPassword = await bcrypt.hash(dto.Password, 10);

    const user = await this.prisma.users.create({
      data: {
        FirstName: dto.FirstName,
        LastName: dto.LastName,
        EmployeeId: dto.EmployeeId,
        PasswordHash: hashedPassword,
        Section: dto.Section,
        Role: dto.Role,
        MobileNo: dto.MobileNo,
        Email: dto.Email,
        IsActive: dto.IsActive ?? true,
      },
      select: userSelectFields,
    });

    this.auditService.log({
      entityType: 'User',
      entityId: user.Id,
      action: 'CREATE',
      changes: { after: user },
    });

    return user;
  }

  async update(id: number, dto: UpdateUserDto): Promise<Omit<Users, 'PasswordHash'>> {
    const before = await this.findOne(id);

    const updateData: Record<string, unknown> = {};

    if (dto.FirstName !== undefined) updateData.FirstName = dto.FirstName;
    if (dto.LastName !== undefined) updateData.LastName = dto.LastName;
    if (dto.EmployeeId !== undefined) {
      const existing = await this.findByEmployeeId(dto.EmployeeId);
      if (existing && existing.Id !== id) {
        throw new ConflictException(`Employee ID ${dto.EmployeeId} already exists`);
      }
      updateData.EmployeeId = dto.EmployeeId;
    }
    if (dto.Password) {
      updateData.PasswordHash = await bcrypt.hash(dto.Password, 10);
    }
    if (dto.Section !== undefined) updateData.Section = dto.Section;
    if (dto.Role !== undefined) updateData.Role = dto.Role;
    if (dto.MobileNo !== undefined) updateData.MobileNo = dto.MobileNo;
    if (dto.Email !== undefined) updateData.Email = dto.Email;
    if (dto.IsActive !== undefined) updateData.IsActive = dto.IsActive;

    const updated = await this.prisma.users.update({
      where: { Id: id },
      data: updateData,
      select: userSelectFields,
    });

    this.auditService.log({
      entityType: 'User',
      entityId: id,
      action: 'UPDATE',
      changes: { before, after: updated },
    });

    return updated;
  }

  async remove(id: number): Promise<Omit<Users, 'PasswordHash'>> {
    const user = await this.findOne(id);
    await this.prisma.users.delete({ where: { Id: id } });

    this.auditService.log({
      entityType: 'User',
      entityId: id,
      action: 'DELETE',
      changes: { before: user },
    });

    return user;
  }

  async deactivate(id: number): Promise<Omit<Users, 'PasswordHash'>> {
    await this.findOne(id);
    const updated = await this.prisma.users.update({
      where: { Id: id },
      data: { IsActive: false },
      select: userSelectFields,
    });

    this.auditService.log({
      entityType: 'User',
      entityId: id,
      action: 'DEACTIVATE',
    });

    return updated;
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.prisma.users.update({
      where: { Id: id },
      data: { LastLogin: new Date() },
    });
  }
}
