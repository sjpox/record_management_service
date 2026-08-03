import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { MaintenanceService } from './maintenance.service';
import { PermissionsService } from '../permissions/permissions.service';

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly permissions: PermissionsService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (!(await this.maintenanceService.isActive())) {
      return next();
    }

    // Allow roles with maintenance bypass permission
    const token = this.extractToken(req);
    if (token) {
      try {
        const payload = this.jwtService.verify(token) as { sub: number };
        const user = await this.prisma.users.findUnique({
          where: { Id: payload.sub },
          select: { Role: true, IsActive: true },
        });

        if (user?.IsActive && user.Role && await this.permissions.isAllowed(user.Role, 'maintenance', 'bypass')) {
          return next();
        }
      } catch {
        // Invalid token — fall through to 503
      }
    }

    res.status(503).json({
      statusCode: 503,
      message: await this.maintenanceService.getMessage(),
    });
  }

  private extractToken(req: Request): string | null {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      return auth.slice(7);
    }
    return null;
  }
}
