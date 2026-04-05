import { Controller, Get, Post, Body, Param, UseGuards, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('users')
  getUsers() {
    return this.chatService.getUsers();
  }

  @Get('conversations')
  getConversations(@CurrentUser() user: { Id: number }) {
    return this.chatService.getConversations(user.Id);
  }

  @Post('conversations')
  createConversation(
    @CurrentUser() user: { Id: number },
    @Body() dto: CreateConversationDto,
  ) {
    // Group chat: participantIds + name
    if (dto.participantIds && dto.participantIds.length > 0) {
      if (!dto.name) {
        throw new BadRequestException('Group name is required for group chats');
      }
      return this.chatService.createGroupConversation(user.Id, dto.participantIds, dto.name);
    }

    // Direct message: participantId
    if (dto.participantId) {
      return this.chatService.createDirectConversation(user.Id, dto.participantId);
    }

    throw new BadRequestException('Provide participantId for DM or participantIds for group chat');
  }

  @Get('conversations/:id/messages')
  getMessages(
    @CurrentUser() user: { Id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.chatService.getMessages(id, user.Id);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @CurrentUser() user: { Id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(id, user.Id, dto.content);
  }

  @Post('conversations/:id/read')
  markAsRead(
    @CurrentUser() user: { Id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.chatService.markAsRead(id, user.Id);
  }
}
