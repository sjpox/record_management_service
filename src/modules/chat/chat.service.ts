import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

const userSelect = {
  Id: true,
  FirstName: true,
  LastName: true,
  EmployeeId: true,
  Role: true,
  IsActive: true,
};

@Injectable()
export class ChatService {
  // Observable for broadcasting new messages in real-time
  readonly newMessage$ = new Subject<{
    message: any;
    conversationId: number;
    recipientIds: number[];
  }>();

  // Observable for broadcasting conversation updates (name or members changed)
  readonly conversationUpdated$ = new Subject<{
    conversation: any;
    recipientIds: number[];
    addedUserIds: number[];
    removedUserIds: number[];
  }>();

  // Observable for broadcasting conversation deletion
  readonly conversationDeleted$ = new Subject<{
    conversationId: number;
    recipientIds: number[];
  }>();

  // Track online users: userId -> Set<socketId>
  private onlineUsers = new Map<number, Set<string>>();
  readonly userStatus$ = new Subject<{ userId: number; isOnline: boolean }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // -- Online tracking --

  userConnected(userId: number, socketId: string) {
    if (!this.onlineUsers.has(userId)) {
      this.onlineUsers.set(userId, new Set());
    }
    const wasOffline = this.onlineUsers.get(userId)!.size === 0;
    this.onlineUsers.get(userId)!.add(socketId);
    if (wasOffline) {
      this.userStatus$.next({ userId, isOnline: true });
    }
  }

  userDisconnected(userId: number, socketId: string) {
    const sockets = this.onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.onlineUsers.delete(userId);
        this.userStatus$.next({ userId, isOnline: false });
      }
    }
  }

  isUserOnline(userId: number): boolean {
    const sockets = this.onlineUsers.get(userId);
    return !!sockets && sockets.size > 0;
  }

  // -- Users --

  async getUsers() {
    const users = await this.prisma.users.findMany({
      where: { IsActive: true },
      select: userSelect,
      orderBy: { FirstName: 'asc' },
    });

    return users.map((u) => ({
      id: u.Id,
      firstName: u.FirstName,
      lastName: u.LastName,
      employeeId: u.EmployeeId,
      role: u.Role || 'encoder',
      isOnline: this.isUserOnline(u.Id),
    }));
  }

  // -- Helper to format a conversation --

  private formatConversation(
    conv: any,
    unreadCount: number,
  ) {
    const lastMsg = conv.Messages?.[0] || null;
    return {
      id: String(conv.Id),
      name: conv.Name || null,
      isGroup: conv.IsGroup,
      createdById: conv.CreatedById ?? null,
      participants: (conv.Participants || []).map((p: any) => ({
        id: p.User.Id,
        firstName: p.User.FirstName,
        lastName: p.User.LastName,
        employeeId: p.User.EmployeeId,
        role: p.User.Role || 'encoder',
        isOnline: this.isUserOnline(p.User.Id),
      })),
      lastMessage: lastMsg
        ? {
            id: String(lastMsg.Id),
            conversationId: String(lastMsg.ConversationId),
            senderId: lastMsg.SenderId,
            content: lastMsg.Content,
            createdAt: lastMsg.CreatedAt.toISOString(),
            readAt: lastMsg.ReadAt?.toISOString() || null,
          }
        : null,
      unreadCount,
      updatedAt: conv.UpdatedAt.toISOString(),
    };
  }

  // -- Conversations --

  async getConversations(userId: number) {
    const conversations = await this.prisma.chatConversation.findMany({
      where: {
        Participants: { some: { UserId: userId } },
      },
      include: {
        Participants: { include: { User: { select: userSelect } } },
        Messages: {
          orderBy: { CreatedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { UpdatedAt: 'desc' },
    });

    const unreadCounts = await Promise.all(
      conversations.map((conv) =>
        this.prisma.chatMessage.count({
          where: {
            ConversationId: conv.Id,
            SenderId: { not: userId },
            ReadAt: null,
          },
        }),
      ),
    );

    return conversations.map((conv, i) => this.formatConversation(conv, unreadCounts[i]));
  }

  async createDirectConversation(userId: number, participantId: number) {
    if (userId === participantId) {
      throw new BadRequestException('Cannot create a conversation with yourself');
    }

    const participant = await this.prisma.users.findUnique({
      where: { Id: participantId },
      select: userSelect,
    });
    if (!participant) throw new NotFoundException('User not found');

    // Check if a 1-to-1 conversation already exists between these two users
    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        IsGroup: false,
        AND: [
          { Participants: { some: { UserId: userId } } },
          { Participants: { some: { UserId: participantId } } },
        ],
      },
      include: {
        Participants: { include: { User: { select: userSelect } } },
        Messages: { orderBy: { CreatedAt: 'desc' }, take: 1 },
      },
    });

    if (existing) {
      return this.formatConversation(existing, 0);
    }

    // Create new 1-to-1 conversation
    const conv = await this.prisma.chatConversation.create({
      data: {
        IsGroup: false,
        CreatedById: userId,
        Participants: {
          create: [{ UserId: userId }, { UserId: participantId }],
        },
      },
      include: {
        Participants: { include: { User: { select: userSelect } } },
        Messages: { orderBy: { CreatedAt: 'desc' }, take: 1 },
      },
    });

    await this.audit.log({ entityType: 'ChatConversation', entityId: conv.Id, action: 'create', userId, changes: { after: { participantId } } });
    return this.formatConversation(conv, 0);
  }

  async createGroupConversation(userId: number, participantIds: number[], name: string) {
    // Ensure creator is included
    const allIds = Array.from(new Set([userId, ...participantIds]));

    if (allIds.length < 3) {
      throw new BadRequestException('Group chat requires at least 3 participants');
    }

    // Verify all participants exist
    const users = await this.prisma.users.findMany({
      where: { Id: { in: allIds } },
      select: { Id: true },
    });
    if (users.length !== allIds.length) {
      throw new NotFoundException('One or more users not found');
    }

    const conv = await this.prisma.chatConversation.create({
      data: {
        Name: name,
        IsGroup: true,
        CreatedById: userId,
        Participants: {
          create: allIds.map((id) => ({ UserId: id })),
        },
      },
      include: {
        Participants: { include: { User: { select: userSelect } } },
        Messages: { orderBy: { CreatedAt: 'desc' }, take: 1 },
      },
    });

    await this.audit.log({ entityType: 'ChatConversation', entityId: conv.Id, action: 'create_group', userId, changes: { after: { name, participantIds } } });
    return this.formatConversation(conv, 0);
  }

  // -- Messages --

  async getMessages(conversationId: number, userId: number) {
    const conv = await this.prisma.chatConversation.findFirst({
      where: {
        Id: conversationId,
        Participants: { some: { UserId: userId } },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const messages = await this.prisma.chatMessage.findMany({
      where: { ConversationId: conversationId },
      orderBy: { CreatedAt: 'asc' },
    });

    return messages.map((m) => ({
      id: String(m.Id),
      conversationId: String(m.ConversationId),
      senderId: m.SenderId,
      content: m.Content,
      createdAt: m.CreatedAt.toISOString(),
      readAt: m.ReadAt?.toISOString() || null,
    }));
  }

  async sendMessage(conversationId: number, senderId: number, content: string) {
    const conv = await this.prisma.chatConversation.findFirst({
      where: {
        Id: conversationId,
        Participants: { some: { UserId: senderId } },
      },
      include: {
        Participants: { select: { UserId: true } },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const recipientIds = conv.Participants
      .map((p) => p.UserId)
      .filter((id) => id !== senderId);

    const message = await this.prisma.chatMessage.create({
      data: {
        ConversationId: conversationId,
        SenderId: senderId,
        Content: content,
      },
    });

    await this.prisma.chatConversation.update({
      where: { Id: conversationId },
      data: { UpdatedAt: new Date() },
    });

    const formatted = {
      id: String(message.Id),
      conversationId: String(message.ConversationId),
      senderId: message.SenderId,
      content: message.Content,
      createdAt: message.CreatedAt.toISOString(),
      readAt: null,
    };

    this.newMessage$.next({
      message: formatted,
      conversationId: conv.Id,
      recipientIds,
    });

    // Notify each recipient
    const sender = await this.prisma.users.findUnique({ where: { Id: senderId }, select: { FirstName: true, LastName: true } });
    const senderName = sender ? `${sender.FirstName} ${sender.LastName}` : 'Someone';
    const conversationName = conv.Name || senderName;
    for (const recipientId of recipientIds) {
      await this.notifications.notify({
        userId: recipientId,
        type: 'chat_message',
        title: `New message from ${conversationName}`,
        body: content.length > 100 ? content.slice(0, 97) + '...' : content,
        entityType: 'ChatConversation',
        entityId: conversationId,
      });
    }

    await this.audit.log({ entityType: 'ChatMessage', entityId: message.Id, action: 'create', userId: senderId, changes: { after: { conversationId } } });
    return formatted;
  }

  async markAsRead(conversationId: number, userId: number) {
    await this.prisma.chatMessage.updateMany({
      where: {
        ConversationId: conversationId,
        SenderId: { not: userId },
        ReadAt: null,
      },
      data: { ReadAt: new Date() },
    });
  }

  // -- Group management --

  async updateGroupConversation(
    conversationId: number,
    userId: number,
    updates: { name?: string; participantIds?: number[] },
  ) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { Id: conversationId },
      include: { Participants: { select: { UserId: true } } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (!conv.IsGroup) throw new BadRequestException('Only group chats can be edited');
    if (conv.CreatedById !== userId) throw new ForbiddenException('Only the group creator can edit this group');

    const beforeName = conv.Name;
    const beforeMemberIds = conv.Participants.map((p) => p.UserId).sort();

    let addedUserIds: number[] = [];
    let removedUserIds: number[] = [];

    if (updates.participantIds !== undefined) {
      // Always include the creator
      const desiredIds = Array.from(new Set([userId, ...updates.participantIds]));

      if (desiredIds.length < 3) {
        throw new BadRequestException('Group chat requires at least 3 participants');
      }

      const users = await this.prisma.users.findMany({
        where: { Id: { in: desiredIds } },
        select: { Id: true },
      });
      if (users.length !== desiredIds.length) {
        throw new NotFoundException('One or more users not found');
      }

      addedUserIds = desiredIds.filter((id) => !beforeMemberIds.includes(id));
      removedUserIds = beforeMemberIds.filter((id) => !desiredIds.includes(id));

      if (removedUserIds.includes(userId)) {
        throw new BadRequestException('The group creator cannot be removed');
      }

      await this.prisma.$transaction([
        ...(removedUserIds.length > 0
          ? [
              this.prisma.chatParticipant.deleteMany({
                where: { ConversationId: conversationId, UserId: { in: removedUserIds } },
              }),
            ]
          : []),
        ...(addedUserIds.length > 0
          ? [
              this.prisma.chatParticipant.createMany({
                data: addedUserIds.map((id) => ({ ConversationId: conversationId, UserId: id })),
              }),
            ]
          : []),
      ]);
    }

    if (updates.name !== undefined && updates.name.trim() !== '' && updates.name !== beforeName) {
      await this.prisma.chatConversation.update({
        where: { Id: conversationId },
        data: { Name: updates.name },
      });
    }

    const updated = await this.prisma.chatConversation.findUnique({
      where: { Id: conversationId },
      include: {
        Participants: { include: { User: { select: userSelect } } },
        Messages: { orderBy: { CreatedAt: 'desc' }, take: 1 },
      },
    });

    const formatted = this.formatConversation(updated, 0);
    const recipientIds = updated!.Participants.map((p) => p.UserId);

    this.conversationUpdated$.next({
      conversation: formatted,
      // Notify both current members and newly added/removed users
      recipientIds: Array.from(new Set([...recipientIds, ...removedUserIds])),
      addedUserIds,
      removedUserIds,
    });

    await this.audit.log({
      entityType: 'ChatConversation',
      entityId: conversationId,
      action: 'update_group',
      userId,
      changes: {
        before: { name: beforeName, memberIds: beforeMemberIds },
        after: { name: updates.name ?? beforeName, addedUserIds, removedUserIds },
      },
    });

    return formatted;
  }

  async deleteGroupConversation(conversationId: number, userId: number) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { Id: conversationId },
      include: { Participants: { select: { UserId: true } } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (!conv.IsGroup) throw new BadRequestException('Only group chats can be deleted');
    if (conv.CreatedById !== userId) throw new ForbiddenException('Only the group creator can delete this group');

    const recipientIds = conv.Participants.map((p) => p.UserId);

    // Cascade-deletes Participants and Messages via FK onDelete: Cascade
    await this.prisma.chatConversation.delete({ where: { Id: conversationId } });

    this.conversationDeleted$.next({ conversationId, recipientIds });

    await this.audit.log({
      entityType: 'ChatConversation',
      entityId: conversationId,
      action: 'delete_group',
      userId,
      changes: { before: { name: conv.Name, memberIds: recipientIds } },
    });

    return { success: true };
  }
}
