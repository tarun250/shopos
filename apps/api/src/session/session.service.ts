import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AIService } from '../ai/ai.service';

const toAmount = (value: unknown, field: string) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new BadRequestException(`${field} must be a non-negative number`);
  return n;
};

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly prisma: PrismaService, private readonly aiService: AIService) {}

  getActive() {
    return this.prisma.client.daySession.findFirst({ where: { status: 'OPEN' }, include: { cashTransactions: true } });
  }

  /** Expected drawer cash = money in (opening deposit, sales, deposits) minus money out. */
  expectedCash(transactions: Array<{ type: string; amount: number }>) {
    const sum = (types: string[]) => transactions.filter(t => types.includes(t.type)).reduce((s, t) => s + t.amount, 0);
    return sum(['IN', 'SALE', 'DEPOSIT']) - sum(['OUT', 'EXPENSE', 'WITHDRAWAL']);
  }

  async open(input: { openingUser: string; openingCash: unknown; openingCard?: unknown; openingUpi?: unknown; openingNotes?: string }) {
    const openingCash = toAmount(input.openingCash, 'Opening cash');
    const openingCard = toAmount(input.openingCard, 'Opening card');
    const openingUpi = toAmount(input.openingUpi, 'Opening UPI');

    return this.prisma.client.$transaction(async tx => {
      const active = await tx.daySession.findFirst({ where: { status: 'OPEN' } });
      if (active) throw new ConflictException('A day session is already active. Close it before opening a new one.');
      const session = await tx.daySession.create({
        data: { openingUser: input.openingUser, openingCash, openingCard, openingUpi, openingNotes: input.openingNotes || '', status: 'OPEN' },
      });
      await tx.cashDrawerTransaction.create({ data: { sessionId: session.id, type: 'DEPOSIT', amount: openingCash, notes: 'Session Opening Cash' } });
      return session;
    });
  }

  async close(input: { actualCash: unknown; closingNotes?: string }) {
    const actualCash = toAmount(input.actualCash, 'Actual cash');
    const session = await this.getActive();
    if (!session) throw new BadRequestException('No active session found to close.');

    const expectedCash = this.expectedCash(session.cashTransactions);
    const difference = actualCash - expectedCash;
    const threshold = Number((await this.prisma.client.systemSetting.findUnique({ where: { key: 'cash_diff_threshold' } }))?.value || '500');
    const status = Math.abs(difference) > threshold ? 'PENDING_APPROVAL' : 'CLOSED';
    const totalSales = session.cashTransactions.filter(t => t.type === 'SALE').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = session.cashTransactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

    let aiSummary = 'AI summary unavailable.';
    try {
      aiSummary = await this.aiService.generate(
        `You are the ShopOS Auditor. Write a concise daily closing summary for the owner.
- Opening user: ${session.openingUser}
- Opening cash: ₹${session.openingCash.toFixed(2)}
- Expected cash in drawer: ₹${expectedCash.toFixed(2)}
- Actual cash counted: ₹${actualCash.toFixed(2)}
- Difference: ₹${difference.toFixed(2)}
- Cash sales: ₹${totalSales.toFixed(2)}
- Cash expenses: ₹${totalExpenses.toFixed(2)}
Explain any difference and give a quick health check of the day.`,
        { taskType: 'REASONING', allowMock: false },
      );
    } catch (e: any) {
      this.logger.error(`AI session summary failed: ${e.message}`);
    }

    // Only close if it is still open (guards against two concurrent close requests)
    const result = await this.prisma.client.daySession.updateMany({
      where: { id: session.id, status: 'OPEN' },
      data: { closingTime: new Date(), expectedCash, actualCash, difference, closingNotes: input.closingNotes || '', status, aiSummary },
    });
    if (result.count === 0) throw new ConflictException('This session was already closed.');
    return this.prisma.client.daySession.findUniqueOrThrow({ where: { id: session.id } });
  }

  async approve(id: string) {
    const session = await this.prisma.client.daySession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'PENDING_APPROVAL') throw new BadRequestException('Only sessions waiting for approval can be approved.');
    return this.prisma.client.daySession.update({ where: { id }, data: { status: 'CLOSED' } });
  }

  async recordCashTransaction(input: { type: string; amount: unknown; notes?: string }) {
    if (input.type !== 'DEPOSIT' && input.type !== 'WITHDRAWAL') throw new BadRequestException('Type must be DEPOSIT or WITHDRAWAL');
    const amount = toAmount(input.amount, 'Amount');
    if (amount === 0) throw new BadRequestException('Amount must be greater than zero');
    const session = await this.prisma.client.daySession.findFirst({ where: { status: 'OPEN' } });
    if (!session) throw new BadRequestException('No active session. Open a day session to post transactions.');
    return this.prisma.client.cashDrawerTransaction.create({ data: { sessionId: session.id, type: input.type, amount, notes: input.notes || '' } });
  }

  history() {
    return this.prisma.client.daySession.findMany({ orderBy: { openingTime: 'desc' }, take: 10 });
  }
}
