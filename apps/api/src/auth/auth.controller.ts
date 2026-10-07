import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request } from 'express';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifyPinDto {
  @IsString()
  @IsNotEmpty()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'PIN must be a 4-digit number' })
  pin: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request, @Body() body: LoginDto) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(body.username, body.password, ipAddress, userAgent);
  }

  @Post('verify-pin')
  @HttpCode(HttpStatus.OK)
  async verifyPin(@Body() body: VerifyPinDto) {
    return this.authService.verifyManagerPin(body.pin);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Body() body: RefreshDto) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.refreshSession(body.refreshToken, ipAddress, userAgent);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: RefreshDto) {
    return this.authService.logoutSession(body.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Body() body: { userId: string }) {
    return this.authService.logoutAllSessions(body.userId);
  }
}
