import { Controller, Post, Get, Body, BadRequestException, ConflictException, Param, Logger } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma.service';
import { AIService } from '../ai/ai.service';

@Controller('session')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionController {
  private readonly logger = new Logger(SessionController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService
  ) {}

  @Get('status')
  async getStatus() {
    const active = await this.prisma.client.daySession.findFirst({
      where: { status: 'OPEN' },
      include: { cashTransactions: true }
    });
    return active || null;
  }

  @Post('open')
  async openSession(@Body() body: {
    openingUser: string;
    openingCash: number;
    openingCard: number;
    openingUpi: number;
    openingNotes?: string;
  }) {
    // Check if there is already an open session
    const active = await this.prisma.client.daySession.findFirst({
      where: { status: 'OPEN' }
    });
    if (active) {
      throw new ConflictException('A day session is already active. Close it before opening a new one.');
    }

    const session = await this.prisma.client.daySession.create({
      data: {
        openingUser: body.openingUser,
        openingCash: body.openingCash,
        openingCard: body.openingCard,
        openingUpi: body.openingUpi,
        openingNotes: body.openingNotes || '',
        status: 'OPEN'
      }
    });

    // Record initial cash transaction in drawer
    await this.prisma.client.cashDrawerTransaction.create({
      data: {
        sessionId: session.id,
        type: 'DEPOSIT',
        amount: body.openingCash,
        notes: 'Session Opening Cash'
      }
    });

    return session;
  }

  @Post('close')
  async closeSession(@Body() body: {
    actualCash: number;
    closingNotes?: string;
    userId: string;
  }) {
    const session = await this.prisma.client.daySession.findFirst({
      where: { status: 'OPEN' },
      include: { cashTransactions: true }
    });
    if (!session) {
      throw new BadRequestException('No active session found to close.');
    }

    // Compute expected cash drawer total based on transactions
    const totalIn = session.cashTransactions
      .filter(t => ['IN', 'SALE', 'DEPOSIT'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalOut = session.cashTransactions
      .filter(t => ['OUT', 'EXPENSE', 'WITHDRAWAL'].includes(t.type))
      .reduce((sum, t) => sum + t.amount, 0);

    // Initial opening cash is already recorded as a DEPOSIT, so expected is simply (totalIn - totalOut)
    const expectedCash = totalIn - totalOut;
    const difference = body.actualCash - expectedCash;

    // Check difference approval threshold (e.g. ₹500 difference requires owner check)
    const settings = await this.prisma.client.systemSetting.findMany().catch(() => []);
    const threshold = Number(settings.find(s => s.key === 'cash_diff_threshold')?.value || '500');

    let finalStatus = 'CLOSED';
    if (Math.abs(difference) > threshold) {
      finalStatus = 'PENDING_APPROVAL';
    }

    // Load session summaries for AI generator
    const totalSales = session.cashTransactions
      .filter(t => t.type === 'SALE')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = session.cashTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    // Invoke AI summary generation
    const summaryPrompt = `
    You are the ShopOS Auditor. Generate a concise, professional daily closing report summary for the business owner.
    Session details:
    - Opening User: ${session.openingUser}
    - Opening Cash: ₹${session.openingCash.toFixed(2)}
    - Expected Cash in Drawer: ₹${expectedCash.toFixed(2)}
    - Actual Cash counted: ₹${body.actualCash.toFixed(2)}
    - Difference: ₹${difference.toFixed(2)}
    - Total Cash Sales: ₹${totalSales.toFixed(2)}
    - Total Expense Deductions: ₹${totalExpenses.toFixed(2)}

    Explain if there is a difference or outline a quick health check of today's business.
    `;

    let aiSummary = 'AI summary unavailable.';
    try {
      aiSummary = await this.aiService.generate(summaryPrompt, { taskType: 'REASONING' });
    } catch (e: any) {
      this.logger.error(`AI session summary failed: ${e.message}`);
    }

    const updated = await this.prisma.client.daySession.update({
      where: { id: session.id },
      data: {
        closingTime: new Date(),
        expectedCash,
        actualCash: body.actualCash,
        difference,
        closingNotes: body.closingNotes || '',
        status: finalStatus,
        aiSummary
      }
    });

    return updated;
  }

  @Post(':id/approve')
  @Roles('OWNER', 'MANAGER')
  async approveSession(@Param('id') id: string, @Body() body: { userId: string }) {
    const session = await this.prisma.client.daySession.findUnique({
      where: { id }
    });
    if (!session) {
      throw new BadRequestException('Session not found');
    }

    const updated = await this.prisma.client.daySession.update({
      where: { id },
      data: { status: 'CLOSED' }
    });

    return updated;
  }

  @Post('cash-transaction')
  async recordCashTransaction(@Body() body: {
    type: 'DEPOSIT' | 'WITHDRAWAL';
    amount: number;
    notes?: string;
  }) {
    const session = await this.prisma.client.daySession.findFirst({
      where: { status: 'OPEN' }
    });
    if (!session) {
      throw new BadRequestException('No active session. Open a day session to post transactions.');
    }

    const tx = await this.prisma.client.cashDrawerTransaction.create({
      data: {
        sessionId: session.id,
        type: body.type,
        amount: body.amount,
        notes: body.notes || ''
      }
    });

    return tx;
  }

  @Get('history')
  async getHistory() {
    return this.prisma.client.daySession.findMany({
      orderBy: { openingTime: 'desc' },
      take: 10
    });
  }
}
