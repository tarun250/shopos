import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Strong password complexity validation rule
  validatePasswordPolicy(password: string) {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (password.length < minLength) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }
    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      throw new BadRequestException(
        'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character'
      );
    }
  }

  async login(username: string, passwordRaw: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials or inactive user');
    }

    const matches = await bcrypt.compare(passwordRaw, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateSession(user, ipAddress, userAgent);
  }

  async verifyManagerPin(pin: string) {
    const managers = await this.prisma.client.user.findMany({
      where: {
        role: { in: ['OWNER', 'MANAGER'] },
        isActive: true,
      },
    });

    let authenticatedManager = null;
    for (const mgr of managers) {
      const pinMatches = await bcrypt.compare(pin, mgr.pinHash);
      if (pinMatches) {
        authenticatedManager = mgr;
        break;
      }
    }

    if (!authenticatedManager) {
      throw new UnauthorizedException('Invalid Manager PIN');
    }

    return {
      success: true,
      approvedBy: authenticatedManager.fullName,
      role: authenticatedManager.role,
      userId: authenticatedManager.id,
    };
  }

  async generateSession(user: any, ipAddress?: string, userAgent?: string) {
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = this.hashToken(refreshToken);

    await this.prisma.client.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      accessToken,
      refreshToken,
      user: payload,
    };
  }

  async refreshSession(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = this.hashToken(refreshToken);

    const session = await this.prisma.client.userSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (!session || session.isRevoked || new Date() > session.expiresAt || !session.user.isActive) {
      if (session) {
        await this.prisma.client.userSession.updateMany({
          where: { userId: session.userId },
          data: { isRevoked: true },
        });
      }
      throw new UnauthorizedException('Invalid or expired refresh session');
    }

    await this.prisma.client.userSession.update({
      where: { id: session.id },
      data: { isRevoked: true },
    });

    return this.generateSession(session.user, ipAddress, userAgent);
  }

  async logoutSession(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.client.userSession.updateMany({
      where: { refreshTokenHash: tokenHash },
      data: { isRevoked: true },
    });
    return { success: true };
  }

  async logoutAllSessions(userId: string) {
    await this.prisma.client.userSession.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
    return { success: true };
  }
}
