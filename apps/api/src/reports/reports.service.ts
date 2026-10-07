import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const r2 = (n: number) => Math.round(n * 100) / 100;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DAY_MS = 86400000;

// "YYYY-MM-DD" is read as a local calendar date (new Date("2026-10-08") would be UTC midnight)
const parseDay = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
};

function parseRange(from?: string, to?: string) {
  const end = to ? parseDay(to) : new Date();
  const start = from ? parseDay(from) : new Date(end.getTime() - 29 * DAY_MS);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new BadRequestException('from/to must be valid dates (YYYY-MM-DD)');
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (end < start) throw new BadRequestException('from must be before to');
  if (end.getTime() - start.getTime() > 400 * DAY_MS) throw new BadRequestException('Range can be at most about a year');
  return { start, end };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(from: string | undefined, to: string | undefined, role: string) {
    const db = this.prisma.client;
    const { start, end } = parseRange(from, to);
    const billWhere = { isQuote: false, status: 'FINALIZED', createdAt: { gte: start, lte: end } };
    const isOwner = role === 'OWNER';

    const [bills, items, expenses, returns, products, debtors] = await Promise.all([
      db.bill.findMany({ where: billWhere, select: { id: true, netAmount: true, cgstAmount: true, sgstAmount: true, balanceAmount: true, paymentMethod: true, createdAt: true } }),
      db.billItem.findMany({
        where: { bill: billWhere },
        select: {
          quantity: true, unitPrice: true, discount: true, bill: { select: { createdAt: true } },
          product: { select: { id: true, name: true, sku: true, category: { select: { name: true } }, stockLevels: { select: { costPrice: true } } } },
        },
      }),
      db.expense.findMany({ where: { createdAt: { gte: start, lte: end } }, select: { amount: true, category: true, createdAt: true } }),
      db.salesReturn.aggregate({ where: { createdAt: { gte: start, lte: end } }, _sum: { netAmount: true }, _count: true }),
      db.product.findMany({ where: { isDeleted: false }, select: { id: true, name: true, sku: true, stockLevels: { select: { quantity: true, costPrice: true } } } }),
      db.customer.findMany({ where: { isDeleted: false, balance: { gt: 0 } }, orderBy: { balance: 'desc' }, take: 15, select: { id: true, name: true, phone: true, balance: true, creditLimit: true } }),
    ]);

    // Daily series
    const days = new Map<string, { date: string; revenue: number; bills: number; profit: number; expenses: number }>();
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
      const key = dayKey(new Date(t));
      days.set(key, { date: key, revenue: 0, bills: 0, profit: 0, expenses: 0 });
    }
    for (const b of bills) {
      const d = days.get(dayKey(b.createdAt));
      if (d) { d.revenue += b.netAmount; d.bills += 1; }
    }
    for (const e of expenses) {
      const d = days.get(dayKey(e.createdAt));
      if (d) d.expenses += e.amount;
    }

    const byProduct = new Map<string, { id: string; name: string; sku: string; quantity: number; revenue: number; profit: number }>();
    const byCategory = new Map<string, { category: string; revenue: number; profit: number }>();
    let revenueBeforeGst = 0;
    let costOfGoods = 0;
    for (const i of items) {
      const taxable = i.quantity * (i.unitPrice - i.discount);
      const cost = i.quantity * (i.product.stockLevels[0]?.costPrice || 0);
      revenueBeforeGst += taxable;
      costOfGoods += cost;
      const d = days.get(dayKey(i.bill.createdAt));
      if (d) d.profit += taxable - cost;
      const p = byProduct.get(i.product.id) || { id: i.product.id, name: i.product.name, sku: i.product.sku, quantity: 0, revenue: 0, profit: 0 };
      p.quantity += i.quantity; p.revenue += taxable; p.profit += taxable - cost;
      byProduct.set(i.product.id, p);
      const catName = i.product.category?.name || 'Uncategorised';
      const c = byCategory.get(catName) || { category: catName, revenue: 0, profit: 0 };
      c.revenue += taxable; c.profit += taxable - cost;
      byCategory.set(catName, c);
    }

    const paymentMix = new Map<string, { method: string; amount: number; bills: number }>();
    for (const b of bills) {
      const m = paymentMix.get(b.paymentMethod) || { method: b.paymentMethod, amount: 0, bills: 0 };
      m.amount += b.netAmount; m.bills += 1;
      paymentMix.set(b.paymentMethod, m);
    }

    // Slow movers: in stock but nothing sold in the period, largest stock value first
    const sold = new Set(byProduct.keys());
    const slowMoving = products
      .filter(p => !sold.has(p.id) && (p.stockLevels[0]?.quantity || 0) > 0)
      .map(p => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stockLevels[0].quantity, stockValue: r2(p.stockLevels[0].quantity * p.stockLevels[0].costPrice) }))
      .sort((a, b) => b.stockValue - a.stockValue)
      .slice(0, 10);

    // Overdue: age of the oldest unpaid credit bill per debtor
    const oldestUnpaid = await db.bill.groupBy({
      by: ['customerId'],
      where: { customerId: { in: debtors.map(d => d.id) }, isQuote: false, status: 'FINALIZED', balanceAmount: { gt: 0 } },
      _min: { createdAt: true },
    });
    const ageById = new Map(oldestUnpaid.map(o => [o.customerId, o._min.createdAt ? Math.floor((Date.now() - o._min.createdAt.getTime()) / DAY_MS) : null]));

    const revenue = bills.reduce((s, b) => s + b.netAmount, 0);
    const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const strip = <T extends { profit: number }>(row: T) => {
      if (isOwner) return { ...row, profit: r2(row.profit) };
      const { profit, ...rest } = row;
      return rest;
    };

    return {
      range: { from: dayKey(start), to: dayKey(end) },
      kpis: {
        revenue: r2(revenue),
        revenueBeforeGst: r2(revenueBeforeGst),
        bills: bills.length,
        averageBill: bills.length ? r2(revenue / bills.length) : 0,
        gstCollected: r2(bills.reduce((s, b) => s + b.cgstAmount + b.sgstAmount, 0)),
        creditOutstandingFromPeriod: r2(bills.reduce((s, b) => s + b.balanceAmount, 0)),
        expenses: r2(expenseTotal),
        returns: { count: returns._count, amount: r2(returns._sum.netAmount || 0) },
        ...(isOwner ? { profit: r2(revenueBeforeGst - costOfGoods), netProfit: r2(revenueBeforeGst - costOfGoods - expenseTotal) } : {}),
      },
      daily: [...days.values()].map(d => strip({ ...d, revenue: r2(d.revenue), expenses: r2(d.expenses) })),
      paymentMix: [...paymentMix.values()].map(m => ({ ...m, amount: r2(m.amount) })).sort((a, b) => b.amount - a.amount),
      categories: [...byCategory.values()].sort((a, b) => b.revenue - a.revenue).map(c => strip({ ...c, revenue: r2(c.revenue) })),
      topProducts: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10).map(p => strip({ ...p, revenue: r2(p.revenue) })),
      slowMoving: isOwner ? slowMoving : slowMoving.map(({ stockValue, ...rest }) => rest),
      overdueCustomers: debtors.map(d => ({ ...d, oldestUnpaidDays: ageById.get(d.id) ?? null })),
    };
  }

  /** GST working for a month: outward supplies (B2B/B2C, rate-wise, HSN-wise), credit notes and input tax on purchases. */
  async gst(month?: string) {
    const db = this.prisma.client;
    const now = new Date();
    const m = month && /^\d{4}-\d{2}$/.test(month) ? month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [y, mo] = m.split('-').map(Number);
    const start = new Date(y, mo - 1, 1);
    const end = new Date(y, mo, 1);

    const [bills, returns, purchaseLines] = await Promise.all([
      db.bill.findMany({
        where: { isQuote: false, status: 'FINALIZED', createdAt: { gte: start, lt: end } },
        include: { customer: { select: { name: true, gstin: true } }, items: { include: { product: { select: { hsnCode: true, name: true, baseUnit: { select: { abbreviation: true } } } } } } },
        orderBy: { createdAt: 'asc' },
      }),
      db.salesReturn.findMany({ where: { createdAt: { gte: start, lt: end } }, include: { bill: { select: { billNumber: true } } } }),
      db.inventoryHistory.findMany({ where: { type: 'PURCHASE', createdAt: { gte: start, lt: end } }, include: { stockLevel: { select: { product: { select: { cgstRate: true, sgstRate: true } } } } } }),
    ]);

    const rateWise = new Map<number, { rate: number; taxable: number; cgst: number; sgst: number }>();
    const hsnWise = new Map<string, { hsn: string; description: string; unit: string; quantity: number; taxable: number; cgst: number; sgst: number }>();
    const b2b: any[] = [];
    let b2cTaxable = 0, b2cCgst = 0, b2cSgst = 0;

    for (const b of bills) {
      if (b.customer?.gstin) {
        b2b.push({ billNumber: b.billNumber, date: b.createdAt, customer: b.customer.name, gstin: b.customer.gstin, taxable: r2(b.totalAmount), cgst: r2(b.cgstAmount), sgst: r2(b.sgstAmount), invoiceValue: r2(b.netAmount) });
      } else {
        b2cTaxable += b.totalAmount; b2cCgst += b.cgstAmount; b2cSgst += b.sgstAmount;
      }
      for (const i of b.items) {
        const taxable = i.quantity * (i.unitPrice - i.discount);
        const rate = i.cgstRate + i.sgstRate;
        const r = rateWise.get(rate) || { rate, taxable: 0, cgst: 0, sgst: 0 };
        r.taxable += taxable; r.cgst += i.cgstAmount; r.sgst += i.sgstAmount;
        rateWise.set(rate, r);
        const hsn = i.product.hsnCode || 'NA';
        const h = hsnWise.get(hsn) || { hsn, description: i.product.name, unit: i.product.baseUnit.abbreviation, quantity: 0, taxable: 0, cgst: 0, sgst: 0 };
        h.quantity += i.quantity; h.taxable += taxable; h.cgst += i.cgstAmount; h.sgst += i.sgstAmount;
        hsnWise.set(hsn, h);
      }
    }

    const outputCgst = bills.reduce((s, b) => s + b.cgstAmount, 0) - returns.reduce((s, r) => s + r.cgstAmount, 0);
    const outputSgst = bills.reduce((s, b) => s + b.sgstAmount, 0) - returns.reduce((s, r) => s + r.sgstAmount, 0);
    let inputCgst = 0, inputSgst = 0;
    for (const p of purchaseLines) {
      const base = p.quantityChanged * p.costPrice;
      inputCgst += (base * p.stockLevel.product.cgstRate) / 100;
      inputSgst += (base * p.stockLevel.product.sgstRate) / 100;
    }
    const round = (o: any) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? r2(v) : v]));

    return {
      month: m,
      note: 'Working figures to help prepare GSTR-1 and GSTR-3B. Verify with your accountant before filing.',
      totals: { invoices: bills.length, taxable: r2(bills.reduce((s, b) => s + b.totalAmount, 0)), cgst: r2(bills.reduce((s, b) => s + b.cgstAmount, 0)), sgst: r2(bills.reduce((s, b) => s + b.sgstAmount, 0)) },
      b2b,
      b2c: { taxable: r2(b2cTaxable), cgst: r2(b2cCgst), sgst: r2(b2cSgst) },
      rateWise: [...rateWise.values()].sort((a, b) => a.rate - b.rate).map(round),
      hsnSummary: [...hsnWise.values()].sort((a, b) => b.taxable - a.taxable).map(round),
      creditNotes: returns.map(r => ({ returnNumber: r.returnNumber, againstBill: r.bill.billNumber, date: r.createdAt, taxable: r2(r.totalAmount), cgst: r2(r.cgstAmount), sgst: r2(r.sgstAmount) })),
      liability: {
        outputCgst: r2(outputCgst), outputSgst: r2(outputSgst),
        inputCgst: r2(inputCgst), inputSgst: r2(inputSgst),
        netCgstPayable: r2(Math.max(0, outputCgst - inputCgst)), netSgstPayable: r2(Math.max(0, outputSgst - inputSgst)),
      },
    };
  }

  /**
   * Reorder suggestions from the last 30 days of sales:
   * suggested = average daily sales × (lead time + cover days) + minimum stock − stock − already on order.
   */
  async reorder(leadDays = 7, coverDays = 14) {
    const db = this.prisma.client;
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [products, sales, openLines] = await Promise.all([
      db.product.findMany({
        where: { isDeleted: false },
        include: { stockLevels: true, baseUnit: true, suppliers: { include: { supplier: { select: { id: true, name: true } } } } },
      }),
      db.billItem.groupBy({ by: ['productId'], where: { bill: { isQuote: false, status: 'FINALIZED', createdAt: { gte: since } } }, _sum: { quantity: true } }),
      db.purchaseItem.findMany({ where: { purchaseOrder: { status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] } } }, select: { productId: true, quantity: true, receivedQuantity: true } }),
    ]);
    const sold = new Map(sales.map(s => [s.productId, s._sum.quantity || 0]));
    const onOrder = new Map<string, number>();
    for (const l of openLines) onOrder.set(l.productId, (onOrder.get(l.productId) || 0) + (l.quantity - l.receivedQuantity));

    const rows = products.map(p => {
      const stock = p.stockLevels[0];
      const quantity = stock?.quantity ?? 0;
      const minStock = stock?.minStockLevel ?? 0;
      const sold30 = sold.get(p.id) || 0;
      const avgDaily = sold30 / 30;
      const incoming = onOrder.get(p.id) || 0;
      const needed = avgDaily * (leadDays + coverDays) + minStock - quantity - incoming;
      const primary = p.suppliers.find(s => s.isPrimary) || p.suppliers[0];
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.baseUnit.abbreviation,
        stock: quantity,
        minStock,
        soldLast30Days: sold30,
        averageDailySales: r2(avgDaily),
        daysOfCover: avgDaily > 0 ? r2(quantity / avgDaily) : null,
        onOrder: incoming,
        suggestedQuantity: Math.max(0, Math.ceil(needed)),
        lastCost: stock?.costPrice ?? 0,
        supplier: primary ? primary.supplier : null,
        urgent: quantity <= minStock,
      };
    }).filter(r => r.suggestedQuantity > 0)
      .sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.daysOfCover ?? 9999) - (b.daysOfCover ?? 9999));

    const bySupplier = new Map<string, { supplier: { id: string; name: string } | null; items: typeof rows; estimatedCost: number }>();
    for (const r of rows) {
      const key = r.supplier?.id || 'none';
      const group = bySupplier.get(key) || { supplier: r.supplier, items: [], estimatedCost: 0 };
      group.items.push(r);
      group.estimatedCost = r2(group.estimatedCost + r.suggestedQuantity * r.lastCost);
      bySupplier.set(key, group);
    }
    return { leadDays, coverDays, items: rows, bySupplier: [...bySupplier.values()] };
  }
}
