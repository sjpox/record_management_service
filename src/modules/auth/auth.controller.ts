import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Headers,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService, UserPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with employee ID and password' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<{
    user: UserPayload;
    accessToken: string;
    refreshToken: string;
  }> {
    return this.authService.login(dto, req.ip);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate token' })
  logout(
    @Headers('authorization') authHeader: string,
    @CurrentUser() user: { Id: number },
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const token = authHeader?.replace('Bearer ', '');
    return this.authService.logout(token, user.Id, req.ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  getMe(@CurrentUser() user: { Id: number }): Promise<UserPayload> {
    return this.authService.getMe(user.Id);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    return this.authService.refresh(dto.refreshToken);
  }
}
