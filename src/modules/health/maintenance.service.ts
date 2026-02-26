import { Injectable } from '@nestjs/common';

@Injectable()
export class MaintenanceService {
  isActive(): boolean {
    return process.env.MAINTENANCE_MODE === 'true';
  }

  getMessage(): string {
    return (
      process.env.MAINTENANCE_MESSAGE ||
      'The system is currently under maintenance. Please try again later.'
    );
  }
}
