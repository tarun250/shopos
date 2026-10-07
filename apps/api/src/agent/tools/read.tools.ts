import { z } from 'zod';
import { ReadTool } from './types';
import { dateWhere, periodRange, resolveBill, resolveCustomer, resolveProduct, resolveSupplier } from './resolvers';

const PERIODS = ['today', 'yesterday', 'week', 'month', 'this_month', 'all', 'custom'] as const;
const periodField = z.enum(PERIODS).optional().describe('Time period; use "custom" with from/to dates');
const dateField = (what: string) => z.string().optional().describe(`${what} date (YYYY-MM-DD), only with period "custom"`);

const productView = (p: any) => {
  const stock = p.stockLevels?.[0];
  return {
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    category: p.category?.name,
    unit: p.baseUnit?.abbreviation,
    rack: p.rackLocation,
    stock: stock?.quantity ?? 0,
    minStock: stock?.minStockLevel ?? 0,
    lowStock: (stock?.quantity ?? 0) <= (stock?.minStockLevel ?? 0),
    costPrice: stock?.costPrice, // removed for non-owners by the guardrail layer
    mrp: p.mrp,
    prices: { level1: p.level1Price, level2_default: p.level2Price, level3_minimum: p.level3Price, emergency: p.emergencyPrice },
    gstPercent: p.cgstRate + p.sgstRate,
    hsn: p.hsnCode,
  };
};

const billView = (b: any) => ({
  billNumber: b.billNumber,
  date: b.createdAt,
  customer: b.customer?.name || 'Walk-in',
  status: b.isQuote ? 'QUOTE' : b.status,
  paymentMethod: b.paymentMethod,
  netAmount: b.netAmount,
  paid: b.paidAmount,
  due: b.balanceAmount,
});

export const searchProducts: ReadTool = {
  name: 'search_products',
  kind: 'read',
  groups: ['core', 'product'],
  description: 'Find products by name, SKU, barcode or description (e.g. "something to fix a leaking pipe"). Returns stock and prices. Use lowStockOnly for reorder questions.',
  schema: z.object({
    query: z.string().optional().describe('Words to search for; omit to list products'),
    lowStockOnly: z.boolean().optional().describe('Only products at or below their minimum stock'),
    category: z.string().optional().describe('Category name filter'),
    limit: z.number().int().min(1).max(25).optional(),
  }),
  async execute(args, ctx) {
    const db = ctx.prisma.client;
    const limit = args.limit ?? 10;
    const include = { stockLevels: true, baseUnit: true, category: true };
    const q = args.query?.trim();
    const where: any = { isDeleted: false };
    if (args.category) where.category = { name: { contains: args.category } };

    let products: any[] = [];
    if (q) {
      products = await db.product.findMany({
        where: { ...where, OR: [{ name: { contains: q } }, { sku: { contains: q } }, { barcode: q }, { aliases: { some: { aliasName: { contains: q.toLowerCase() } } } }] },
        include,
        take: 50,
      });
      // Add semantic matches for descriptive queries
      const hits = await ctx.rag.search(q, { scope: 'PRODUCT', limit: 8, maxPerDocument: 1 }).catch(() => []);
      const missing = hits.map(h => h.sourceId).filter((id): id is string => !!id && !products.some(p => p.id === id));
      if (missing.length) {
        const extra = await db.product.findMany({ where: { ...where, id: { in: missing } }, include });
        products.push(...missing.map(id => extra.find(p => p.id === id)).filter(Boolean));
      }
    } else {
      products = await db.product.findMany({ where, include, orderBy: { name: 'asc' } });
    }
    let views = products.map(productView);
    if (args.lowStockOnly) views = views.filter(v => v.lowStock);
    return { count: views.length, products: views.slice(0, limit) };
  },
};

export const getProduct: ReadTool = {
  name: 'get_product',
  kind: 'read',
  groups: ['product', 'stock'],
  description: 'Full details for one product including stock, prices and recent stock movements.',
  schema: z.object({ product: z.string().describe('Product name, SKU, barcode or alias') }),
  async execute(args, ctx) {
    const p = await resolveProduct(ctx, args.product);
    const history = p.stockLevels[0]
      ? await ctx.prisma.client.inventoryHistory.findMany({ where: { stockLevelId: p.stockLevels[0].id }, orderBy: { createdAt: 'desc' }, take: 8 })
      : [];
    return {
      ...productView(p),
      description: p.description,
      aliases: p.aliases.map((a: any) => a.aliasName),
      recentMovements: history.map(h => ({ date: h.createdAt, type: h.type, change: h.quantityChanged, balance: h.balanceQuantity })),
    };
  },
};

export const searchCustomers: ReadTool = {
  name: 'search_customers',
  kind: 'read',
  groups: ['core', 'customer', 'payment'],
  description: 'Find customers by name or phone. Use owesMoney=true to list customers with outstanding balances (largest first).',
  schema: z.object({
    query: z.string().optional(),
    owesMoney: z.boolean().optional(),
    limit: z.number().int().min(1).max(25).optional(),
  }),
  async execute(args, ctx) {
    const q = args.query?.trim();
    const customers = await ctx.prisma.client.customer.findMany({
      where: {
        isDeleted: false,
        ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q.replace(/\D/g, '') || q } }] } : {}),
        ...(args.owesMoney ? { balance: { gt: 0 } } : {}),
      },
      orderBy: args.owesMoney ? { balance: 'desc' } : { name: 'asc' },
      take: args.limit ?? 10,
    });
    return customers.map(c => ({ name: c.name, phone: c.phone, priceLevel: c.priceLevel, creditLimit: c.creditLimit, balanceOwed: c.balance, gstin: c.gstin }));
  },
};

export const getCustomerAccount: ReadTool = {
  name: 'get_customer_account',
  kind: 'read',
  groups: ['customer', 'payment'],
  description: "A customer's details, balance, credit headroom, recent ledger entries and recent bills.",
  schema: z.object({ customer: z.string().describe('Customer name or phone') }),
  async execute(args, ctx) {
    const c = await resolveCustomer(ctx, args.customer);
    const [ledger, bills] = await Promise.all([
      ctx.prisma.client.customerLedger.findMany({ where: { customerId: c.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
      ctx.prisma.client.bill.findMany({ where: { customerId: c.id }, orderBy: { createdAt: 'desc' }, take: 8, include: { customer: true } }),
    ]);
    return {
      name: c.name, phone: c.phone, email: c.email, gstin: c.gstin, address: c.address, priceLevel: c.priceLevel,
      creditLimit: c.creditLimit, balanceOwed: c.balance, creditAvailable: Math.max(0, c.creditLimit - c.balance),
      recentLedger: ledger.map(l => ({ date: l.createdAt, type: l.transactionType, debit: l.debit, credit: l.credit, balance: l.runningBalance })),
      recentBills: bills.map(billView),
    };
  },
};

export const searchSuppliers: ReadTool = {
  name: 'search_suppliers',
  kind: 'read',
  groups: ['supplier'],
  description: 'Find suppliers by name; shows how much the shop owes each.',
  schema: z.object({ query: z.string().optional() }),
  async execute(args, ctx) {
    const q = args.query?.trim();
    const suppliers = await ctx.prisma.client.supplier.findMany({
      where: { isDeleted: false, ...(q ? { OR: [{ name: { contains: q } }, { companyName: { contains: q } }] } : {}) },
      orderBy: { name: 'asc' },
      take: 15,
    });
    return suppliers.map(s => ({ name: s.name, company: s.companyName, phone: s.phone, gstin: s.gstin, amountWeOwe: s.balance }));
  },
};

export const getSupplierAccount: ReadTool = {
  name: 'get_supplier_account',
  kind: 'read',
  roles: ['OWNER', 'MANAGER'],
  groups: ['supplier'],
  description: "A supplier's balance, recent ledger entries and purchase orders.",
  schema: z.object({ supplier: z.string() }),
  async execute(args, ctx) {
    const s = await resolveSupplier(ctx, args.supplier);
    const [ledger, orders] = await Promise.all([
      ctx.prisma.client.supplierLedger.findMany({ where: { supplierId: s.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
      ctx.prisma.client.purchaseOrder.findMany({ where: { supplierId: s.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);
    return {
      name: s.name, company: s.companyName, phone: s.phone, gstin: s.gstin, amountWeOwe: s.balance,
      recentLedger: ledger.map(l => ({ date: l.createdAt, type: l.transactionType, debit: l.debit, credit: l.credit, balance: l.runningBalance })),
      recentPurchaseOrders: orders.map(o => ({ poNumber: o.poNumber, date: o.createdAt, net: o.netAmount, due: o.balanceAmount, status: o.status })),
    };
  },
};

export const searchBills: ReadTool = {
  name: 'search_bills',
  kind: 'read',
  groups: ['core', 'bill'],
  description: 'List bills/orders filtered by period, customer, payment method or status. Includes totals for the matching set.',
  schema: z.object({
    customer: z.string().optional().describe('Customer name or phone'),
    period: periodField,
    from: dateField('Start'),
    to: dateField('End'),
    paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'CREDIT']).optional(),
    status: z.enum(['FINALIZED', 'PENDING_APPROVAL', 'REJECTED', 'QUOTE']).optional(),
    limit: z.number().int().min(1).max(25).optional(),
  }),
  async execute(args, ctx) {
    const range = periodRange(args.period, args.from, args.to);
    const where: any = { ...dateWhere(range) };
    if (args.status === 'QUOTE') where.isQuote = true;
    else {
      where.isQuote = false;
      if (args.status) where.status = args.status;
    }
    if (args.paymentMethod) where.paymentMethod = args.paymentMethod;
    if (args.customer) {
      const q = args.customer.trim();
      where.customer = { OR: [{ name: { contains: q } }, { phone: { contains: q } }] };
    }
    const db = ctx.prisma.client;
    const [bills, totals] = await Promise.all([
      db.bill.findMany({ where, include: { customer: true }, orderBy: { createdAt: 'desc' }, take: args.limit ?? 10 }),
      db.bill.aggregate({ where, _sum: { netAmount: true, balanceAmount: true }, _count: true }),
    ]);
    return { period: range.label, matching: totals._count, totalValue: totals._sum.netAmount || 0, totalDue: totals._sum.balanceAmount || 0, bills: bills.map(billView) };
  },
};

export const getBill: ReadTool = {
  name: 'get_bill',
  kind: 'read',
  groups: ['core', 'bill', 'return'],
  description: 'Full details of one bill: items, taxes, payments, returns and approval status.',
  schema: z.object({ billNumber: z.string() }),
  async execute(args, ctx) {
    const b: any = await resolveBill(ctx, args.billNumber);
    const returned: Record<string, number> = {};
    for (const r of b.salesReturns) for (const i of r.items) returned[i.productId] = (returned[i.productId] || 0) + i.quantity;
    return {
      ...billView(b),
      customerPhone: b.customer?.phone,
      items: b.items.map((i: any) => ({
        product: i.product.name, sku: i.product.sku, quantity: i.quantity, unitPrice: i.unitPrice, discountPerUnit: i.discount,
        gstPercent: i.cgstRate + i.sgstRate, lineTotal: i.totalPrice, alreadyReturned: returned[i.productId] || 0,
      })),
      taxable: b.totalAmount, cgst: b.cgstAmount, sgst: b.sgstAmount, billDiscount: b.discountAmount,
      returns: b.salesReturns.map((r: any) => ({ returnNumber: r.returnNumber, date: r.createdAt, refund: r.netAmount, reason: r.reason })),
      approval: b.approvals[0] ? { status: b.approvals[0].status, reason: b.approvals[0].description } : null,
    };
  },
};

export const salesReport: ReadTool = {
  name: 'sales_report',
  kind: 'read',
  groups: ['core', 'report'],
  description: 'Sales summary for a period: bill count, revenue, GST, payment mix, top products, expenses and (owner only) gross profit. Use for any "how did we do" question.',
  schema: z.object({ period: z.enum(PERIODS).describe('Period to report on'), from: dateField('Start'), to: dateField('End') }),
  async execute(args, ctx) {
    const db = ctx.prisma.client;
    const range = periodRange(args.period, args.from, args.to);
    const billWhere: any = { isQuote: false, status: 'FINALIZED', ...dateWhere(range) };
    const [totals, byMethod, items, expenses, returns] = await Promise.all([
      db.bill.aggregate({ where: billWhere, _sum: { netAmount: true, cgstAmount: true, sgstAmount: true, balanceAmount: true }, _count: true }),
      db.bill.groupBy({ by: ['paymentMethod'], where: billWhere, _sum: { netAmount: true }, _count: true }),
      db.billItem.findMany({ where: { bill: billWhere }, include: { product: { select: { name: true, stockLevels: { select: { costPrice: true } } } } } }),
      db.expense.aggregate({ where: dateWhere(range), _sum: { amount: true } }),
      db.salesReturn.aggregate({ where: dateWhere(range), _sum: { netAmount: true }, _count: true }),
    ]);

    const byProduct = new Map<string, { quantity: number; revenueBeforeGst: number }>();
    let costOfGoods = 0;
    let revenueBeforeGst = 0;
    for (const i of items) {
      const taxable = i.quantity * (i.unitPrice - i.discount);
      revenueBeforeGst += taxable;
      costOfGoods += i.quantity * (i.product.stockLevels[0]?.costPrice || 0);
      const e = byProduct.get(i.product.name) || { quantity: 0, revenueBeforeGst: 0 };
      e.quantity += i.quantity;
      e.revenueBeforeGst += taxable;
      byProduct.set(i.product.name, e);
    }
    const isOwner = ctx.user.role === 'OWNER';
    return {
      period: range.label,
      bills: totals._count,
      revenueInclGst: totals._sum.netAmount || 0,
      revenueBeforeGst,
      gstCollected: (totals._sum.cgstAmount || 0) + (totals._sum.sgstAmount || 0),
      soldOnCreditStillDue: totals._sum.balanceAmount || 0,
      averageBill: totals._count ? (totals._sum.netAmount || 0) / totals._count : 0,
      paymentMix: byMethod.map(m => ({ method: m.paymentMethod, bills: m._count, amount: m._sum.netAmount || 0 })),
      topProducts: [...byProduct.entries()].sort((a, b) => b[1].revenueBeforeGst - a[1].revenueBeforeGst).slice(0, 5).map(([name, v]) => ({ name, ...v })),
      returns: { count: returns._count, refunded: returns._sum.netAmount || 0 },
      expenses: expenses._sum.amount || 0,
      ...(isOwner ? { grossProfit: revenueBeforeGst - costOfGoods, profitAfterExpenses: revenueBeforeGst - costOfGoods - (expenses._sum.amount || 0) } : { note: 'Profit figures are visible to the owner only.' }),
    };
  },
};

export const listExpenses: ReadTool = {
  name: 'list_expenses',
  kind: 'read',
  groups: ['expense', 'report'],
  description: 'Expenses for a period, optionally by category, with totals per category.',
  schema: z.object({ period: periodField, from: dateField('Start'), to: dateField('End'), category: z.string().optional() }),
  async execute(args, ctx) {
    const range = periodRange(args.period ?? 'month', args.from, args.to);
    const where: any = { ...dateWhere(range), ...(args.category ? { category: args.category.toUpperCase() } : {}) };
    const [rows, byCategory] = await Promise.all([
      ctx.prisma.client.expense.findMany({ where, orderBy: { createdAt: 'desc' }, take: 20 }),
      ctx.prisma.client.expense.groupBy({ by: ['category'], where, _sum: { amount: true } }),
    ]);
    return {
      period: range.label,
      total: byCategory.reduce((s, c) => s + (c._sum.amount || 0), 0),
      byCategory: byCategory.map(c => ({ category: c.category, amount: c._sum.amount || 0 })),
      expenses: rows.map(e => ({ date: e.createdAt, category: e.category, amount: e.amount, notes: e.notes })),
    };
  },
};

export const listReminders: ReadTool = {
  name: 'list_reminders',
  kind: 'read',
  groups: ['reminder'],
  description: 'Upcoming and overdue reminders (GST filing, dues, licences).',
  schema: z.object({ includeDismissed: z.boolean().optional() }),
  async execute(args, ctx) {
    const rows = await ctx.prisma.client.reminder.findMany({
      where: args.includeDismissed ? {} : { status: 'PENDING' },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });
    const now = Date.now();
    return rows.map(r => ({ title: r.title, type: r.type, dueDate: r.dueDate, priority: r.priority, status: r.status, overdue: r.dueDate.getTime() < now && r.status === 'PENDING' }));
  },
};

export const listPendingApprovals: ReadTool = {
  name: 'list_pending_approvals',
  kind: 'read',
  roles: ['OWNER', 'MANAGER'],
  groups: ['approval'],
  description: 'Bills waiting for price/loss approval.',
  schema: z.object({}),
  async execute(_args, ctx) {
    const rows = await ctx.prisma.client.approval.findMany({
      where: { status: 'PENDING' },
      include: { requester: { select: { fullName: true } }, bill: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(a => {
      const details = a.actionDetails ? JSON.parse(a.actionDetails) : {};
      return { billNumber: a.bill?.billNumber, customer: a.bill?.customer?.name || 'Walk-in', amount: a.bill?.netAmount, reason: a.description, requiredRole: details.requiredRole || 'MANAGER', requestedBy: a.requester.fullName, requestedAt: a.createdAt };
    });
  },
};

export const getCashDrawerStatus: ReadTool = {
  name: 'get_cash_drawer_status',
  kind: 'read',
  groups: ['cash'],
  description: 'Current day session and expected cash in the drawer.',
  schema: z.object({}),
  async execute(_args, ctx) {
    const session = await ctx.prisma.client.daySession.findFirst({ where: { status: 'OPEN' }, include: { cashTransactions: true } });
    if (!session) return { open: false, message: 'No day session is open.' };
    const sum = (types: string[]) => session.cashTransactions.filter(t => types.includes(t.type)).reduce((s, t) => s + t.amount, 0);
    const cashIn = sum(['IN', 'SALE', 'DEPOSIT']);
    const cashOut = sum(['OUT', 'EXPENSE', 'WITHDRAWAL']);
    return { open: true, openedBy: session.openingUser, openedAt: session.openingTime, openingCash: session.openingCash, cashIn, cashOut, expectedCashInDrawer: cashIn - cashOut };
  },
};

export const searchKnowledgeBase: ReadTool = {
  name: 'search_knowledge_base',
  kind: 'read',
  groups: ['core', 'knowledge'],
  description: 'Search shop policies, procedures and how-to guides (returns, warranty, credit terms, GST rules, how to use ShopOS). Cite results as [n].',
  schema: z.object({ query: z.string().describe('What to look up, in plain words') }),
  async execute(args, ctx) {
    const hits = await ctx.rag.search(args.query, { scope: 'KNOWLEDGE', limit: 5 });
    if (hits.length === 0) return { results: [], note: 'Nothing relevant in the knowledge base. Say so instead of guessing.' };
    return { results: hits.map(h => ({ title: h.title, category: h.category, documentId: h.documentId, text: h.text })) };
  },
};

export const READ_TOOLS: ReadTool[] = [
  searchProducts, getProduct, searchCustomers, getCustomerAccount, searchSuppliers, getSupplierAccount,
  searchBills, getBill, salesReport, listExpenses, listReminders, listPendingApprovals, getCashDrawerStatus, searchKnowledgeBase,
];
