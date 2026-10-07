import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SessionService } from './session.service';

@Controller('session')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Get('status')
  async getStatus() {
    return (await this.sessions.getActive()) || null;
  }

  @Post('open')
  openSession(@Req() req: any, @Body() body: { openingUser?: string; openingCash: number; openingCard?: number; openingUpi?: number; openingNotes?: string }) {
    return this.sessions.open({ ...body, openingUser: req.user?.username || body.openingUser || 'unknown' });
  }

  @Post('close')
  closeSession(@Body() body: { actualCash: number; closingNotes?: string }) {
    return this.sessions.close(body);
  }

  @Post(':id/approve')
  @Roles('OWNER', 'MANAGER')
  approveSession(@Param('id') id: string) {
    return this.sessions.approve(id);
  }

  @Post('cash-transaction')
  @Roles('OWNER', 'MANAGER')
  recordCashTransaction(@Body() body: { type: 'DEPOSIT' | 'WITHDRAWAL'; amount: number; notes?: string }) {
    return this.sessions.recordCashTransaction(body);
  }

  @Get('history')
  getHistory() {
    return this.sessions.history();
  }
}
