import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { MaintenanceService } from './maintenance.service';

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (!this.maintenanceService.isActive()) {
      return next();
    }

    const token = this.extractToken(req);
    if (token) {
      try {
        const secret = process.env.JWT_SECRET ?? 'default-secret-change-me';
        const payload = jwt.verify(token, secret) as unknown as { sub: number };
        const user = await this.prisma.users.findUnique({
          where: { Id: payload.sub },
          select: { Role: true, IsActive: true },
        });

        if (user?.IsActive && user.Role === 'admin') {
          return next();
        }
      } catch {
        // Invalid token — fall through to 503
      }
    }

    res.status(503).json({
      statusCode: 503,
      message: this.maintenanceService.getMessage(),
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
