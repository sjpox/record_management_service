import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Subscription } from 'rxjs';
import { MaintenanceService } from './maintenance.service';

@WebSocketGateway({ namespace: '/maintenance', cors: { origin: '*' } })
export class MaintenanceGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MaintenanceGateway.name);
  private subscription: Subscription;

  constructor(private readonly maintenanceService: MaintenanceService) {}

  afterInit() {
    this.subscription = this.maintenanceService.status$.subscribe((status) => {
      this.server.emit('maintenanceStatus', status);
    });
    this.logger.log('Maintenance WebSocket gateway initialized');
  }

  handleConnection(client: Socket) {
    client.emit('maintenanceStatus', {
      maintenance: this.maintenanceService.isActive(),
      message: this.maintenanceService.isActive()
        ? this.maintenanceService.getMessage()
        : '',
    });
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
  }
}
