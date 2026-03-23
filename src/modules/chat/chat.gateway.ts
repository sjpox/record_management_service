import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { Subscription } from 'rxjs';
import { ChatService } from './chat.service';

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private subscriptions: Subscription[] = [];
  private socketUserMap = new Map<string, number>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit() {
    this.subscriptions.push(
      this.chatService.newMessage$.subscribe(({ message, recipientIds }) => {
        for (const recipientId of recipientIds) {
          this.server.to(`user:${recipientId}`).emit('message', message);
        }
      }),
    );

    this.subscriptions.push(
      this.chatService.userStatus$.subscribe((status) => {
        this.server.emit('userStatus', status);
      }),
    );

    this.logger.log('Chat WebSocket gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`No token provided, disconnecting: ${client.id}`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = typeof payload.sub === 'string' ? parseInt(payload.sub, 10) : payload.sub;

      if (!userId || isNaN(userId)) {
        this.logger.warn(`Invalid user ID in token (sub=${payload.sub}), disconnecting: ${client.id}`);
        client.disconnect();
        return;
      }

      this.socketUserMap.set(client.id, userId);
      client.join(`user:${userId}`);
      this.chatService.userConnected(userId, client.id);

      this.logger.log(`User ${userId} connected to chat (socket: ${client.id})`);
    } catch (err) {
      this.logger.warn(`JWT verification failed for socket ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.socketUserMap.get(client.id);
    if (userId) {
      this.chatService.userDisconnected(userId, client.id);
      this.socketUserMap.delete(client.id);
      this.logger.log(`User ${userId} disconnected from chat (socket: ${client.id})`);
    }
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = this.socketUserMap.get(client.id);
    if (!userId || !data.conversationId) return;

    await this.chatService.markAsRead(parseInt(data.conversationId), userId);
    this.server.emit('messageRead', {
      conversationId: data.conversationId,
      readBy: userId,
    });
  }

  onModuleDestroy() {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }
}
