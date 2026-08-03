import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CacheEntry {
  allowed: boolean;
  expiresAt: number;
}

@Injectable()
export class PermissionsService {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 60_000; // 1 minute cache TTL

  constructor(private readonly prisma: PrismaService) {}

  private cacheKey(role: string, resource: string, action: string) {
    return `${role}:${resource}:${action}`;
  }

  async isAllowed(role: string, resource: string, action: string): Promise<boolean> {
    const key = this.cacheKey(role, resource, action);
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > now) {
      return cached.allowed;
    }

    const record = await this.prisma.rolePermission.findUnique({
      where: { Role_Resource_Action: { Role: role, Resource: resource, Action: action } },
    });

    // Default: admin can do everything, encoder is denied by default
    const allowed = record ? record.Allowed : role === 'admin';

    this.cache.set(key, { allowed, expiresAt: now + this.TTL_MS });
    return allowed;
  }

  invalidateCache(role?: string) {
    if (!role) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${role}:`)) this.cache.delete(key);
    }
  }

  async getAll() {
    return this.prisma.rolePermission.findMany({ orderBy: [{ Role: 'asc' }, { Resource: 'asc' }, { Action: 'asc' }] });
  }

  async upsert(role: string, resource: string, action: string, allowed: boolean) {
    const result = await this.prisma.rolePermission.upsert({
      where: { Role_Resource_Action: { Role: role, Resource: resource, Action: action } },
      create: { Role: role, Resource: resource, Action: action, Allowed: allowed },
      update: { Allowed: allowed },
    });
    this.invalidateCache(role);
    return result;
  }

  async remove(id: number) {
    const record = await this.prisma.rolePermission.findUnique({ where: { Id: id } });
    if (record) this.invalidateCache(record.Role);
    return this.prisma.rolePermission.delete({ where: { Id: id } });
  }
}
