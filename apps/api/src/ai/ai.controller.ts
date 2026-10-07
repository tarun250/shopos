import { Controller, Post, Get, Body, BadRequestException, Logger, Req } from '@nestjs/common';
import { AIService } from './ai.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(
    private readonly aiService: AIService,
    private readonly prisma: PrismaService
  ) {}

  @Post('copilot')
  async handleCopilotQuery(@Body() body: { query: string }, @Req() req: any) {
    const query = body?.query?.trim();
    if (!query) {
      throw new BadRequestException('Query parameter is required');
    }
    const isOwner = req.user?.role === 'OWNER';

    let parsed: any;
    try {
      const systemPrompt = `
      You are the ShopOS ERP Copilot for a retail hardware/electrical/auto-parts shop. Today is ${new Date().toDateString()}.
      Convert the user's query into exactly one JSON object. Respond with the JSON only, no markdown or commentary.

      Supported structures:
      1. Product lookup: {"type":"SEARCH","entity":"PRODUCTS","filters":{"search":"<words or empty>","lowStock":true|false}}
      2. Customer lookup: {"type":"SEARCH","entity":"CUSTOMERS","filters":{"search":"<name/phone or empty>","overdue":true|false}}  (overdue=true for "who owes me money")
      3. Supplier lookup: {"type":"SEARCH","entity":"SUPPLIERS","filters":{"search":"<name or empty>"}}
      4. Bills / orders / sales list: {"type":"SEARCH","entity":"BILLS","filters":{"search":"<bill number or customer name, or empty>","period":"today"|"yesterday"|"week"|"month"|"all","paymentMethod":"CASH"|"UPI"|"CARD"|"CREDIT"|null}}
      5. Expenses list: {"type":"SEARCH","entity":"EXPENSES","filters":{"period":"today"|"yesterday"|"week"|"month"|"all","category":"<RENT|SALARY|TEA|...> or null"}}
      6. Open a screen: {"type":"ACTION","action":"NAVIGATE","params":{"path":"pos"|"inventory"|"order-history"|"customer-ledgers"|"supplier-ledgers"|"returns"|"approvals"|"settings"}}
      7. Add a customer: {"type":"ACTION","action":"CREATE_CUSTOMER","params":{"name":"...","phone":"..."}}
      8. Any question about how the business is doing (sales, profit, trends, advice, summaries): {"type":"ANALYSIS","question":"..."}

      Do not put time words like "today" or "this week" into "search"; use "period" instead.

      User query: ${JSON.stringify(query)}
      `;

      const aiResponse = await this.aiService.generate(systemPrompt, { taskType: 'REASONING', allowMock: false });
      const jsonText = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const start = jsonText.indexOf('{');
      const end = jsonText.lastIndexOf('}');
      try {
        parsed = JSON.parse(start >= 0 && end > start ? jsonText.slice(start, end + 1) : jsonText);
      } catch {
        this.logger.warn('AI output was not valid JSON, returning plain explanation.');
        return { type: 'PLAIN', text: aiResponse };
      }
    } catch (err: any) {
      this.logger.error(`Copilot failed: ${err.message}`);
      return { type: 'PLAIN', text: `Sorry, the AI assistant is unavailable right now. ${err.message}` };
    }

    const filters = parsed.filters || {};
    const search = typeof filters.search === 'string' ? filters.search.trim() : '';

    if (parsed.type === 'SEARCH') {
      if (parsed.entity === 'PRODUCTS') {
        const products = await this.prisma.client.product.findMany({
          where: {
            isDeleted: false,
            ...(search ? { OR: [{ name: { contains: search } }, { sku: { contains: search } }, { aliases: { some: { aliasName: { contains: search } } } }] } : {}),
          },
          include: { stockLevels: true, baseUnit: true },
          orderBy: { name: 'asc' },
        });
        const data = filters.lowStock
          ? products.filter(p => (p.stockLevels[0]?.quantity ?? 0) <= (p.stockLevels[0]?.minStockLevel ?? 0))
          : products;
        return { ...parsed, data: data.slice(0, 20) };
      }

      if (parsed.entity === 'CUSTOMERS') {
        const data = await this.prisma.client.customer.findMany({
          where: {
            isDeleted: false,
            ...(search ? { OR: [{ name: { contains: search } }, { phone: { contains: search } }] } : {}),
            ...(filters.overdue ? { balance: { gt: 0 } } : {}),
          },
          orderBy: filters.overdue ? { balance: 'desc' } : { name: 'asc' },
          take: 20,
        });
        return { ...parsed, data };
      }

      if (parsed.entity === 'SUPPLIERS') {
        const data = await this.prisma.client.supplier.findMany({
          where: {
            isDeleted: false,
            ...(search ? { OR: [{ name: { contains: search } }, { companyName: { contains: search } }] } : {}),
          },
          orderBy: { name: 'asc' },
          take: 20,
        });
        return { ...parsed, data };
      }

      if (parsed.entity === 'BILLS') {
        const data = await this.prisma.client.bill.findMany({
          where: {
            isQuote: false,
            ...this.periodWhere(filters.period),
            ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
            ...(search ? { OR: [{ billNumber: { contains: search } }, { customer: { name: { contains: search } } }] } : {}),
          },
          include: { customer: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 25,
        });
        return { ...parsed, data };
      }

      if (parsed.entity === 'EXPENSES') {
        const data = await this.prisma.client.expense.findMany({
          where: {
            ...this.periodWhere(filters.period),
            ...(filters.category ? { category: String(filters.category).toUpperCase() } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 25,
        });
        return { ...parsed, data };
      }
    }

    if (parsed.type === 'ACTION') {
      if (parsed.action === 'NAVIGATE' && parsed.params?.path) {
        parsed.params.path = String(parsed.params.path).replace(/^\/+/, '');
      }
      return parsed;
    }

    if (parsed.type === 'ANALYSIS') {
      try {
        const context = await this.buildBusinessContext(isOwner);
        const analysis = await this.aiService.generate(`
        You are the ShopOS Advisor. Answer the shop ${isOwner ? 'owner' : 'staff member'}'s question using ONLY the live data below.
        If the data does not contain the answer, say so plainly. Amounts are in Indian Rupees. Keep it short and practical, with bullet points.

        ${context}

        Question: ${JSON.stringify(query)}
        `, { taskType: 'REASONING', allowMock: false });
        return { type: 'PLAIN', text: analysis };
      } catch (err: any) {
        this.logger.error(`Copilot analysis failed: ${err.message}`);
        return { type: 'PLAIN', text: `Sorry, the AI assistant is unavailable right now. ${err.message}` };
      }
    }

    return { type: 'PLAIN', text: "Sorry, I didn't understand that. Try asking about products, customers, bills, expenses or how the business is doing." };
  }

  private periodStart(period?: string): Date | undefined {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === 'today') return d;
    if (period === 'yesterday') { d.setDate(d.getDate() - 1); return d; }
    if (period === 'week') { d.setDate(d.getDate() - 6); return d; }
    if (period === 'month') { d.setDate(d.getDate() - 29); return d; }
    return undefined;
  }

  private periodWhere(period?: string) {
    const gte = this.periodStart(period);
    if (!gte) return {};
    // "yesterday" is a closed range; other periods run up to now
    return { createdAt: period === 'yesterday' ? { gte, lt: this.periodStart('today') } : { gte } };
  }

  // Live numbers the advisor answers from; profit figures are only shared with the owner
  private async buildBusinessContext(includeProfit: boolean): Promise<string> {
    const db = this.prisma.client;
    const today = this.periodStart('today')!;
    const yesterday = this.periodStart('yesterday')!;
    const week = this.periodStart('week')!;
    const month = this.periodStart('month')!;
    const sales = (gte: Date, lt?: Date) => db.bill.aggregate({
      where: { isQuote: false, status: 'FINALIZED', createdAt: { gte, ...(lt ? { lt } : {}) } },
      _sum: { netAmount: true },
      _count: true,
    });

    const [salesToday, salesYesterday, salesWeek, salesMonth, methodsToday, weekItems, products, debtors, payables, expensesWeek, pendingApprovals] = await Promise.all([
      sales(today), sales(yesterday, today), sales(week), sales(month),
      db.bill.groupBy({ by: ['paymentMethod'], where: { isQuote: false, status: 'FINALIZED', createdAt: { gte: today } }, _sum: { netAmount: true } }),
      db.billItem.findMany({
        where: { bill: { isQuote: false, status: 'FINALIZED', createdAt: { gte: week } } },
        include: { product: { select: { name: true, stockLevels: { select: { costPrice: true } } } }, bill: { select: { createdAt: true } } },
      }),
      db.product.findMany({ where: { isDeleted: false }, include: { stockLevels: true } }),
      db.customer.findMany({ where: { isDeleted: false, balance: { gt: 0 } }, orderBy: { balance: 'desc' }, take: 5 }),
      db.supplier.aggregate({ where: { isDeleted: false }, _sum: { balance: true } }),
      db.expense.groupBy({ by: ['category'], where: { createdAt: { gte: week } }, _sum: { amount: true } }),
      db.approval.count({ where: { status: 'PENDING' } }),
    ]);

    const money = (n?: number | null) => `₹${(n || 0).toFixed(2)}`;
    const line = (label: string, s: any) => `- ${label}: ${s._count} bills, ${money(s._sum.netAmount)}`;

    const byProduct = new Map<string, { qty: number; revenue: number }>();
    let profitToday = 0;
    let profitWeek = 0;
    for (const item of weekItems) {
      const taxable = item.quantity * (item.unitPrice - item.discount);
      const cost = item.quantity * (item.product.stockLevels[0]?.costPrice || 0);
      profitWeek += taxable - cost;
      if (item.bill.createdAt >= today) profitToday += taxable - cost;
      const entry = byProduct.get(item.product.name) || { qty: 0, revenue: 0 };
      entry.qty += item.quantity;
      entry.revenue += taxable;
      byProduct.set(item.product.name, entry);
    }
    const topProducts = [...byProduct.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
    const lowStock = products.filter(p => (p.stockLevels[0]?.quantity ?? 0) <= (p.stockLevels[0]?.minStockLevel ?? 0));

    return [
      'SALES (finalized bills, incl. GST):',
      line('Today', salesToday),
      line('Yesterday', salesYesterday),
      line('Last 7 days', salesWeek),
      line('Last 30 days', salesMonth),
      `- Today by payment method: ${methodsToday.map(m => `${m.paymentMethod} ${money(m._sum.netAmount)}`).join(', ') || 'no sales yet'}`,
      ...(includeProfit ? [
        'GROSS PROFIT (selling price before GST minus cost price):',
        `- Today: ${money(profitToday)}`,
        `- Last 7 days: ${money(profitWeek)}`,
      ] : []),
      'TOP PRODUCTS, LAST 7 DAYS (by revenue before GST):',
      ...(topProducts.length ? topProducts.map(([name, v]) => `- ${name}: ${v.qty} units, ${money(v.revenue)}`) : ['- none']),
      `INVENTORY: ${products.length} active products; ${lowStock.length} at or below minimum stock`,
      ...lowStock.map(p => `- LOW: ${p.name} (qty ${p.stockLevels[0]?.quantity ?? 0}, min ${p.stockLevels[0]?.minStockLevel ?? 0})`),
      'CUSTOMERS WHO OWE MONEY (top 5):',
      ...(debtors.length ? debtors.map(c => `- ${c.name} (${c.phone}): ${money(c.balance)}`) : ['- nobody']),
      `SUPPLIER PAYABLES: ${money(payables._sum.balance)} total owed to suppliers`,
      `EXPENSES, LAST 7 DAYS: ${expensesWeek.map(e => `${e.category} ${money(e._sum.amount)}`).join(', ') || 'none'}`,
      `PENDING APPROVALS: ${pendingApprovals}`,
    ].join('\n');
  }

  @Get('settings')
  @Roles('OWNER')
  async getSettings() {
    const settings = await this.prisma.client.systemSetting.findMany();
    // Return settings with sensitive API keys masked
    return settings.map(s => {
      const isKey = s.key.toLowerCase().includes('key');
      return {
        key: s.key,
        value: isKey && s.value ? `${s.value.slice(0, 8)}...*****` : s.value
      };
    });
  }

  @Post('settings')
  @Roles('OWNER')
  async updateSettings(@Body() body: { settings: { key: string; value: string }[] }) {
    if (!body.settings || !Array.isArray(body.settings)) {
      throw new BadRequestException('Settings array is required');
    }

    for (const item of body.settings) {
      // Avoid overwriting a masked key with visual stars
      if (item.value.includes('...*****')) {
        continue;
      }
      await this.prisma.client.systemSetting.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value }
      });
    }

    return { success: true };
  }

  @Get('cost-report')
  @Roles('OWNER')
  async getCostReport() {
    const costSummary = await this.prisma.client.aiCostLog.aggregate({
      _sum: { estimatedCost: true, promptTokens: true, completionTokens: true },
      _count: { id: true }
    });

    const logs = await this.prisma.client.aiCostLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return {
      totalCost: costSummary._sum.estimatedCost || 0.0,
      totalTokens: (costSummary._sum.promptTokens || 0) + (costSummary._sum.completionTokens || 0),
      callsCount: costSummary._count.id,
      recentLogs: logs
    };
  }
}
