import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ReportsService } from '../reports/reports.service';
import { LlmClient } from './llm.client';
import { AgentUser } from './tools/types';
import { redactOutput } from './guardrails';

const CACHE_MS = 60 * 60 * 1000;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Start-of-day summary for the assistant panel, built from live data and phrased by the LLM. */
@Injectable()
export class BriefService {
  private readonly logger = new Logger(BriefService.name);
  private readonly cache = new Map<string, { at: number; brief: { date: string; text: string; generatedBy: string } }>();

  constructor(private readonly prisma: PrismaService, private readonly reports: ReportsService, private readonly llm: LlmClient) {}

  async get(user: AgentUser, refresh = false) {
    const today = new Date();
    const key = `${ymd(today)}|${user.role}`;
    const cached = this.cache.get(key);
    if (cached && !refresh && Date.now() - cached.at < CACHE_MS) return cached.brief;

    const facts = await this.collect(user);
    let text: string;
    let generatedBy = 'summary';
    try {
      const result = await this.llm.chat({
        messages: [
          {
            role: 'system',
            content: 'You write the morning brief for an Indian retail shop owner or staff member. Use ONLY the facts given. Write 4-7 short bullet points, most important first (problems and things to act on today before good news). Use ₹ with Indian formatting. No greeting, no headings, no closing line.',
          },
          { role: 'user', content: facts.lines.join('\n') },
        ],
        maxTokens: 500,
        temperature: 0.3,
      });
      text = redactOutput(result.content.trim());
      generatedBy = result.provider;
    } catch (err: any) {
      this.logger.warn(`Brief LLM unavailable, using plain summary: ${err.message}`);
      text = facts.fallback.map(l => `- ${l}`).join('\n');
    }
    const brief = { date: ymd(today), text, generatedBy };
    this.cache.set(key, { at: Date.now(), brief });
    return brief;
  }

  private async collect(user: AgentUser) {
    const db = this.prisma.client;
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const soon = new Date(now.getTime() + 3 * 86400000);
    const canManage = user.role === 'OWNER' || user.role === 'MANAGER';

    const [y, t, products, debtors, reminders, approvals, session, pendingClose, openPos] = await Promise.all([
      this.reports.summary(ymd(yesterday), ymd(yesterday), user.role),
      this.reports.summary(ymd(now), ymd(now), user.role),
      db.product.findMany({ where: { isDeleted: false }, select: { name: true, stockLevels: { select: { quantity: true, minStockLevel: true } } } }),
      db.customer.findMany({ where: { isDeleted: false, balance: { gt: 0 } }, orderBy: { balance: 'desc' }, take: 3, select: { name: true, balance: true } }),
      db.reminder.findMany({ where: { status: 'PENDING', dueDate: { lte: soon } }, orderBy: { dueDate: 'asc' }, take: 5 }),
      canManage ? db.approval.count({ where: { status: 'PENDING' } }) : Promise.resolve(0),
      db.daySession.findFirst({ where: { status: 'OPEN' } }),
      user.role === 'OWNER' ? db.daySession.count({ where: { status: 'PENDING_APPROVAL' } }) : Promise.resolve(0),
      canManage ? db.purchaseOrder.count({ where: { status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] } } }) : Promise.resolve(0),
    ]);
    const low = products.filter(p => (p.stockLevels[0]?.quantity ?? 0) <= (p.stockLevels[0]?.minStockLevel ?? 0));

    const lines = [
      `Today: ${now.toDateString()}. Reader role: ${user.role}.`,
      `Yesterday: ${y.kpis.bills} bills, sales ${inr(y.kpis.revenue)}${'profit' in y.kpis ? `, gross profit ${inr((y.kpis as any).profit)}` : ''}, expenses ${inr(y.kpis.expenses)}.`,
      `Today so far: ${t.kpis.bills} bills, ${inr(t.kpis.revenue)}.`,
      y.topProducts[0] ? `Yesterday's best seller: ${y.topProducts[0].name} (${y.topProducts[0].quantity} units).` : '',
      `Low or out of stock (${low.length}): ${low.slice(0, 6).map(p => `${p.name} (${p.stockLevels[0]?.quantity ?? 0} left)`).join(', ') || 'none'}.`,
      `Customers owing the most: ${debtors.map(d => `${d.name} ${inr(d.balance)}`).join(', ') || 'none'}.`,
      `Reminders due within 3 days or overdue: ${reminders.map(r => `${r.title} (due ${r.dueDate.toDateString()})`).join('; ') || 'none'}.`,
      canManage ? `Bills waiting for price approval: ${approvals}. Open purchase orders awaiting delivery: ${openPos}.` : '',
      user.role === 'OWNER' && pendingClose ? `Day closings waiting for owner approval (cash difference): ${pendingClose}.` : '',
      session ? `Day session is open (opened by ${session.openingUser}).` : 'No day session is open yet; it should be opened with the cash count before billing.',
    ].filter(Boolean);

    const fallback = [
      `Yesterday: ${y.kpis.bills} bills, ${inr(y.kpis.revenue)} in sales.`,
      `${low.length} items are low or out of stock${low.length ? `: ${low.slice(0, 3).map(p => p.name).join(', ')}` : ''}.`,
      debtors[0] ? `${debtors[0].name} owes the most (${inr(debtors[0].balance)}).` : 'No customer dues.',
      reminders[0] ? `Reminder: ${reminders[0].title} (due ${reminders[0].dueDate.toDateString()}).` : 'No reminders due in the next 3 days.',
      ...(canManage && approvals ? [`${approvals} bill(s) waiting for approval.`] : []),
      session ? 'Day session is open.' : 'Open the day session before billing.',
    ];
    return { lines, fallback };
  }
}
