import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Subject } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_MESSAGE =
  'The system is currently under maintenance. Please try again later.';

@Injectable()
export class MaintenanceService implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceService.name);
  private readonly statusSubject = new Subject<{
    maintenance: boolean;
    message: string;
  }>();

  readonly status$ = this.statusSubject.asObservable();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureConfig();
  }

  async isActive(): Promise<boolean> {
    const config = await this.getConfig();
    return config.IsActive;
  }

  async getMessage(): Promise<string> {
    const config = await this.getConfig();
    return config.Message;
  }

  async setMaintenance(
    active: boolean,
    message?: string,
  ): Promise<{ maintenance: boolean; message: string }> {
    const isActive = String(active) === 'true';

    const config = await this.prisma.maintenanceConfig.upsert({
      where: { Id: 1 },
      update: {
        IsActive: isActive,
        ...(message !== undefined && { Message: message }),
      },
      create: {
        Id: 1,
        IsActive: isActive,
        Message: message ?? DEFAULT_MESSAGE,
      },
    });

    const status = {
      maintenance: config.IsActive,
      message: config.IsActive ? config.Message : '',
    };

    this.statusSubject.next(status);
    return status;
  }

  private async getConfig() {
    return (
      (await this.prisma.maintenanceConfig.findUnique({ where: { Id: 1 } })) ??
      (await this.ensureConfig())
    );
  }

  private async ensureConfig() {
    try {
      return await this.prisma.maintenanceConfig.upsert({
        where: { Id: 1 },
        update: {},
        create: { Id: 1, IsActive: false, Message: DEFAULT_MESSAGE },
      });
    } catch (error) {
      this.logger.warn(
        'Could not initialize maintenance config — table may not exist yet. Run prisma migrate.',
        error instanceof Error ? error.message : error,
      );
      return { Id: 1, IsActive: false, Message: DEFAULT_MESSAGE, UpdatedAt: new Date() };
    }
  }
}
