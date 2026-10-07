import { Controller, Post, Get, Body, Param, BadRequestException } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma.service';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getAllExpenses() {
    return this.prisma.client.expense.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  @Post()
  async createExpense(@Body() body: {
    category: string;
    amount: number;
    notes?: string;
    attachmentUrl?: string;
    isRecurring?: boolean;
    deductFromDrawer?: boolean;
    userId?: string;
  }) {
    if (!body.category || !body.amount) {
      throw new BadRequestException('Category and amount are required.');
    }

    const expense = await this.prisma.client.expense.create({
      data: {
        category: body.category.toUpperCase(),
        amount: body.amount,
        notes: body.notes || '',
        attachmentUrl: body.attachmentUrl || null,
        isRecurring: body.isRecurring || false,
        isApproved: true // default approved
      }
    });

    // Handle direct cash drawer deduction
    if (body.deductFromDrawer) {
      const activeSession = await this.prisma.client.daySession.findFirst({
        where: { status: 'OPEN' }
      });
      if (activeSession) {
        await this.prisma.client.cashDrawerTransaction.create({
          data: {
            sessionId: activeSession.id,
            type: 'EXPENSE',
            amount: body.amount,
            referenceId: expense.id,
            notes: `Expense [${body.category}]: ${body.notes || 'No description'}`
          }
        });
      }
    }

    return expense;
  }

  @Post(':id/approve')
  @Roles('OWNER', 'MANAGER')
  async approveExpense(@Param('id') id: string) {
    return this.prisma.client.expense.update({
      where: { id },
      data: { isApproved: true }
    });
  }
}
