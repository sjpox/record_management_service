import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MaintenanceService } from './maintenance.service';

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (this.maintenanceService.isActive()) {
      res.status(503).json({
        statusCode: 503,
        message: this.maintenanceService.getMessage(),
      });
      return;
    }

    next();
  }
}
