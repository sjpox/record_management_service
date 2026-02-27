import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class MaintenanceService {
  private readonly statusSubject = new Subject<{
    maintenance: boolean;
    message: string;
  }>();

  readonly status$ = this.statusSubject.asObservable();

  isActive(): boolean {
    return process.env.MAINTENANCE_MODE === 'true';
  }

  getMessage(): string {
    return (
      process.env.MAINTENANCE_MESSAGE ||
      'The system is currently under maintenance. Please try again later.'
    );
  }

  setMaintenance(
    active: boolean,
    message?: string,
  ): { maintenance: boolean; message: string } {
    const isActive = String(active) === 'true';
    process.env.MAINTENANCE_MODE = isActive ? 'true' : 'false';
    if (message) {
      process.env.MAINTENANCE_MESSAGE = message;
    }

    const status = {
      maintenance: isActive,
      message: isActive ? this.getMessage() : '',
    };

    this.statusSubject.next(status);
    return status;
  }
}
