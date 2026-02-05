import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

export interface UserPayload {
  Id: number;
  FirstName: string;
  LastName: string;
  EmployeeId: string;
  Section: string | null;
  Role: string | null;
  IsActive: boolean;
}

@Injectable()
export class AuthService {
  private readonly accessTokenExpirySeconds = parseInt(process.env.JWT_EXPIRES_IN ?? '900', 10); // 15 minutes default
  private readonly refreshTokenExpirySeconds = parseInt(process.env.JWT_REFRESH_EXPIRES_IN ?? '604800', 10); // 7 days default

  // Simple in-memory blacklist for invalidated tokens (use Redis in production)
  private tokenBlacklist = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{
    user: UserPayload;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.prisma.users.findFirst({
      where: { EmployeeId: dto.employeeId },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.IsActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.PasswordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.users.update({
      where: { Id: user.Id },
      data: { LastLogin: new Date() },
    });

    const payload = { sub: user.Id, employeeId: user.EmployeeId };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpirySeconds,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.refreshTokenExpirySeconds,
    });

    return {
      user: {
        Id: user.Id,
        FirstName: user.FirstName,
        LastName: user.LastName,
        EmployeeId: user.EmployeeId,
        Section: user.Section,
        Role: user.Role,
        IsActive: user.IsActive,
      },
      accessToken,
      refreshToken,
    };
  }

  async logout(token: string): Promise<{ message: string }> {
    // Add token to blacklist
    this.tokenBlacklist.add(token);
    return { message: 'Logged out successfully' };
  }

  isTokenBlacklisted(token: string): boolean {
    return this.tokenBlacklist.has(token);
  }

  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const payload = this.jwtService.verify(refreshToken);

      if (this.tokenBlacklist.has(refreshToken)) {
        throw new UnauthorizedException('Token has been invalidated');
      }

      const user = await this.prisma.users.findUnique({
        where: { Id: payload.sub },
      });

      if (!user || !user.IsActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Invalidate old refresh token
      this.tokenBlacklist.add(refreshToken);

      const newPayload = { sub: user.Id, employeeId: user.EmployeeId };

      const newAccessToken = this.jwtService.sign(newPayload, {
        expiresIn: this.accessTokenExpirySeconds,
      });

      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: this.refreshTokenExpirySeconds,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getMe(userId: number): Promise<UserPayload> {
    const user = await this.prisma.users.findUnique({
      where: { Id: userId },
      select: {
        Id: true,
        FirstName: true,
        LastName: true,
        EmployeeId: true,
        Section: true,
        Role: true,
        IsActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
