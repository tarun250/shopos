import { z } from 'zod';
import { ToolUserError, WriteTool } from './types';
import { inr, resolveBill, resolveCustomer, resolveProduct, resolveSupplier } from './resolvers';

// Every tool here changes data. prepare() resolves and validates the request into a preview
// without side effects; execute() runs only after the user presses Confirm on that preview.

const money = z.number().positive().max(10_000_000);
const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'CREDIT'] as const;
const r2 = (n: number) => Math.round(n * 100) / 100;

export const createCustomer: WriteTool = {
  name: 'create_customer',
  kind: 'write',
  groups: ['customer'],
  description: 'Register a new customer. Only the owner may set a credit limit.',
  schema: z.object({
    name: z.string().min(2).max(80),
    phone: z.string().describe('10-digit mobile number'),
    priceLevel: z.enum(['RETAIL', 'WHOLESALE', 'CONTRACTOR', 'DISTRIBUTOR']).optional(),
    creditLimit: z.number().min(0).max(10_000_000).optional(),
    email: z.string().email().optional(),
    address: z.string().max(200).optional(),
    gstin: z.string().optional().describe('15-character GSTIN for registered businesses'),
  }),
  async prepare(args, ctx) {
    const phone = args.phone.replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) throw new ToolUserError('Phone number must have 10 digits.');
    if (args.creditLimit !== undefined && ctx.user.role !== 'OWNER') throw new ToolUserError('Only the owner can set a credit limit. Create the customer without one, or ask the owner.');
    const gstin = args.gstin?.toUpperCase().replace(/\s/g, '');
    if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gstin)) throw new ToolUserError(`"${args.gstin}" is not a valid GSTIN.`);
    const existing = await ctx.prisma.client.customer.findUnique({ where: { phone } });
    if (existing) throw new ToolUserError(`A customer with phone ${phone} already exists: ${existing.name}.`);
    const priceLevel = args.priceLevel || 'RETAIL';
    return {
      args: { name: args.name.trim(), phone, priceLevel, creditLimit: args.creditLimit, email: args.email, address: args.address, gstin },
      summary: `Add customer ${args.name.trim()} (${phone})`,
      details: [
        { label: 'Name', value: args.name.trim() },
        { label: 'Phone', value: phone },
        { label: 'Price level', value: priceLevel },
        ...(args.creditLimit !== undefined ? [{ label: 'Credit limit', value: inr(args.creditLimit) }] : []),
        ...(gstin ? [{ label: 'GSTIN', value: gstin }] : []),
        ...(args.address ? [{ label: 'Address', value: args.address }] : []),
      ],
    };
  },
  async execute(args, ctx) {
    const customer = await ctx.billing.createCustomer({ name: args.name, phone: args.phone, email: args.email, address: args.address, priceLevel: args.priceLevel, creditLimit: args.creditLimit });
    if (args.gstin) await ctx.prisma.client.customer.update({ where: { id: customer.id }, data: { gstin: args.gstin } });
    return { result: { created: customer.name, phone: customer.phone } };
  },
};

export const createBill: WriteTool = {
  name: 'create_bill',
  kind: 'write',
  groups: ['bill'],
  description: 'Create a sale bill or a quote. Prices default to the Level 2 price; pass unitPrice only if the user states a price. Walk-in sales need no customer. CREDIT needs a customer with a credit limit.',
  schema: z.object({
    customer: z.string().optional().describe('Customer name or phone; omit for walk-in'),
    items: z.array(z.object({
      product: z.string().describe('Product name, SKU or barcode'),
      quantity: z.number().positive().max(100000),
      unitPrice: z.number().positive().optional().describe('Price per unit before GST, only if the user specified one'),
    })).min(1).max(30),
    paymentMethod: z.enum(PAYMENT_METHODS),
    amountPaid: z.number().min(0).optional().describe('Defaults to the full amount (0 for CREDIT)'),
    billDiscount: z.number().min(0).optional().describe('Discount on the whole bill in rupees'),
    isQuote: z.boolean().optional().describe('Save as a quote; stock is not deducted'),
  }),
  async prepare(args, ctx) {
    const customer = args.customer ? await resolveCustomer(ctx, args.customer) : null;
    const isQuote = !!args.isQuote;
    const isOwner = ctx.user.role === 'OWNER';
    const warnings: string[] = [];
    const lines: any[] = [];
    let taxable = 0;
    let tax = 0;

    const seen = new Set<string>();
    for (const item of args.items) {
      const p: any = await resolveProduct(ctx, item.product);
      if (seen.has(p.id)) throw new ToolUserError(`${p.name} is listed twice; combine the quantities into one line.`);
      seen.add(p.id);
      const stock = p.stockLevels[0];
      if (!stock) throw new ToolUserError(`${p.name} has no stock record.`);
      if (!isQuote && item.quantity > stock.quantity) {
        throw new ToolUserError(`Only ${stock.quantity} ${p.baseUnit.abbreviation} of ${p.name} in stock; ${item.quantity} requested.`);
      }
      const unitPrice = item.unitPrice ?? p.level2Price;
      if (unitPrice < p.level3Price) {
        warnings.push(unitPrice < stock.costPrice
          ? `${p.name} at ${inr(unitPrice)} is below cost and needs the owner's approval${isOwner ? ` (cost ${inr(stock.costPrice)})` : ''}; the bill will wait for approval.`
          : `${p.name} at ${inr(unitPrice)} is below the minimum price ${inr(p.level3Price)} and needs a manager's approval; the bill will wait for approval.`);
      }
      // 1% tolerance so paisa-level rounding of GST-inclusive prices doesn't trigger it
      if (p.mrp && unitPrice * (1 + (p.cgstRate + p.sgstRate) / 100) > p.mrp * 1.01) {
        warnings.push(`${p.name}: price with GST exceeds the MRP of ${inr(p.mrp)}.`);
      }
      const lineTaxable = r2(item.quantity * unitPrice);
      const lineTax = r2((lineTaxable * p.cgstRate) / 100) + r2((lineTaxable * p.sgstRate) / 100);
      taxable += lineTaxable;
      tax += lineTax;
      lines.push({ productId: p.id, name: p.name, unit: p.baseUnit.abbreviation, quantity: item.quantity, unitPrice, lineTotal: r2(lineTaxable + lineTax) });
    }

    const billDiscount = args.billDiscount ?? 0;
    const net = r2(Math.max(0, taxable + tax - billDiscount));
    if (billDiscount > (taxable + tax) * 0.2) warnings.push(`Bill discount ${inr(billDiscount)} is more than 20% of the bill.`);

    let amountPaid = args.amountPaid ?? (args.paymentMethod === 'CREDIT' ? 0 : net);
    if (amountPaid > net) amountPaid = net;
    if (args.paymentMethod === 'CREDIT' || amountPaid < net) {
      if (!isQuote) {
        if (!customer) throw new ToolUserError('Credit or part-payment needs a registered customer.');
        if (customer.creditLimit <= 0) throw new ToolUserError(`${customer.name} has no credit limit; credit sales are not allowed for them.`);
        if (customer.balance + (net - amountPaid) > customer.creditLimit) {
          throw new ToolUserError(`This would take ${customer.name} to ${inr(customer.balance + net - amountPaid)}, over their credit limit of ${inr(customer.creditLimit)}.`);
        }
      }
    }

    return {
      args: { customerId: customer?.id, items: lines.map(l => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, discount: 0 })), paymentMethod: args.paymentMethod, amountPaid, billDiscount, isQuote },
      summary: `${isQuote ? 'Create quote' : 'Create bill'} for ${customer?.name || 'walk-in customer'}: ${inr(net)} (${args.paymentMethod})`,
      details: [
        { label: 'Customer', value: customer ? `${customer.name} (${customer.phone})` : 'Walk-in' },
        ...lines.map(l => ({ label: l.name, value: `${l.quantity} ${l.unit} × ${inr(l.unitPrice)} = ${inr(l.lineTotal)} incl. GST` })),
        { label: 'Taxable value', value: inr(taxable) },
        { label: 'GST', value: inr(tax) },
        ...(billDiscount ? [{ label: 'Bill discount', value: `−${inr(billDiscount)}` }] : []),
        { label: 'Net total', value: inr(net) },
        { label: 'Payment', value: `${args.paymentMethod}, paid ${inr(amountPaid)}${net - amountPaid > 0 ? `, ${inr(net - amountPaid)} on credit` : ''}` },
      ],
      warnings,
    };
  },
  async execute(args, ctx) {
    const bill: any = await ctx.billing.createBill({
      customerId: args.customerId,
      items: args.items,
      discountAmount: args.billDiscount,
      paymentMethod: args.paymentMethod,
      paidAmount: args.amountPaid,
      isQuote: args.isQuote,
      paymentSplits: args.amountPaid > 0 ? [{ paymentMethod: args.paymentMethod, amount: args.amountPaid }] : undefined,
    }, ctx.user.userId);
    return {
      result: { billNumber: bill.billNumber, status: bill.isQuote ? 'QUOTE' : bill.status, netAmount: bill.netAmount },
      uiAction: { type: 'open_bill', billNumber: bill.billNumber },
    };
  },
};

export const recordCustomerPayment: WriteTool = {
  name: 'record_customer_payment',
  kind: 'write',
  groups: ['payment', 'customer'],
  description: 'Record money received from a customer against their outstanding balance.',
  schema: z.object({
    customer: z.string(),
    amount: money,
    paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'CHEQUE']),
    notes: z.string().max(200).optional(),
  }),
  async prepare(args, ctx) {
    const c = await resolveCustomer(ctx, args.customer);
    const warnings = args.amount > c.balance ? [`${c.name} only owes ${inr(c.balance)}; this payment leaves them ${inr(args.amount - c.balance)} in advance.`] : [];
    return {
      args: { customerId: c.id, amount: args.amount, paymentMethod: args.paymentMethod, notes: args.notes },
      summary: `Record ${inr(args.amount)} ${args.paymentMethod} payment from ${c.name}`,
      details: [
        { label: 'Customer', value: `${c.name} (${c.phone})` },
        { label: 'Amount', value: inr(args.amount) },
        { label: 'Method', value: args.paymentMethod },
        { label: 'Balance', value: `${inr(c.balance)} → ${inr(c.balance - args.amount)}` },
        ...(args.notes ? [{ label: 'Notes', value: args.notes }] : []),
      ],
      warnings,
    };
  },
  async execute(args, ctx) {
    const entry = await ctx.billing.recordCustomerPayment(args.customerId, { ...args, userId: ctx.user.userId });
    return { result: { recorded: args.amount, newBalance: entry.runningBalance } };
  },
};

export const recordSupplierPayment: WriteTool = {
  name: 'record_supplier_payment',
  kind: 'write',
  roles: ['OWNER', 'MANAGER'],
  groups: ['payment', 'supplier'],
  description: 'Record a payment the shop made to a supplier.',
  schema: z.object({
    supplier: z.string(),
    amount: money,
    paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']),
    notes: z.string().max(200).optional(),
  }),
  async prepare(args, ctx) {
    const s = await resolveSupplier(ctx, args.supplier);
    return {
      args: { supplierId: s.id, amount: args.amount, paymentMethod: args.paymentMethod, notes: args.notes },
      summary: `Record ${inr(args.amount)} payment to ${s.name}`,
      details: [
        { label: 'Supplier', value: s.name },
        { label: 'Amount', value: inr(args.amount) },
        { label: 'Method', value: args.paymentMethod },
        { label: 'We owe', value: `${inr(s.balance)} → ${inr(s.balance - args.amount)}` },
      ],
      warnings: args.amount > s.balance ? [`We only owe ${s.name} ${inr(s.balance)}.`] : [],
    };
  },
  async execute(args, ctx) {
    const entry = await ctx.billing.recordSupplierPayment(args.supplierId, { ...args, userId: ctx.user.userId });
    return { result: { recorded: args.amount, newBalance: entry.runningBalance } };
  },
};

const EXPENSE_CATEGORIES = ['ELECTRICITY', 'FUEL', 'TRANSPORT', 'SALARY', 'RENT', 'TEA', 'MAINTENANCE', 'CUSTOM'] as const;

export const addExpense: WriteTool = {
  name: 'add_expense',
  kind: 'write',
  groups: ['expense', 'cash'],
  description: 'Log a shop expense, optionally paid from the cash drawer.',
  schema: z.object({
    category: z.enum(EXPENSE_CATEGORIES),
    amount: money,
    notes: z.string().max(200).optional(),
    paidFromCashDrawer: z.boolean().optional().describe('True if the cash came out of the drawer'),
  }),
  async prepare(args, ctx) {
    const session = args.paidFromCashDrawer ? await ctx.prisma.client.daySession.findFirst({ where: { status: 'OPEN' } }) : null;
    return {
      args: { ...args, paidFromCashDrawer: !!args.paidFromCashDrawer },
      summary: `Log ${inr(args.amount)} ${args.category.toLowerCase()} expense`,
      details: [
        { label: 'Category', value: args.category },
        { label: 'Amount', value: inr(args.amount) },
        ...(args.notes ? [{ label: 'Notes', value: args.notes }] : []),
        { label: 'Paid from drawer', value: args.paidFromCashDrawer ? 'Yes' : 'No' },
      ],
      warnings: [
        ...(args.paidFromCashDrawer && !session ? ['No day session is open, so the cash drawer will not be updated.'] : []),
        ...(args.amount > 20000 ? ['This is a large expense; double-check the amount.'] : []),
      ],
    };
  },
  async execute(args, ctx) {
    const db = ctx.prisma.client;
    const expense = await db.$transaction(async tx => {
      const e = await tx.expense.create({ data: { category: args.category, amount: args.amount, notes: args.notes || '', isApproved: true, approvedBy: ctx.user.username } });
      if (args.paidFromCashDrawer) {
        const session = await tx.daySession.findFirst({ where: { status: 'OPEN' } });
        if (session) {
          await tx.cashDrawerTransaction.create({ data: { sessionId: session.id, type: 'EXPENSE', amount: args.amount, referenceId: e.id, notes: `Expense [${args.category}]: ${args.notes || 'No description'}` } });
        }
      }
      return e;
    });
    return { result: { logged: expense.amount, category: expense.category } };
  },
};

export const createReminder: WriteTool = {
  name: 'create_reminder',
  kind: 'write',
  groups: ['reminder'],
  description: 'Create a reminder with a due date.',
  schema: z.object({
    title: z.string().min(3).max(120),
    type: z.enum(['CUSTOMER_DUE', 'SUPPLIER_DUE', 'GST', 'LICENSE', 'WARRANTY', 'INSURANCE', 'CUSTOM']),
    dueDate: z.string().describe('YYYY-MM-DD'),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  }),
  async prepare(args) {
    const due = new Date(args.dueDate);
    if (isNaN(due.getTime())) throw new ToolUserError('Due date must be a valid date (YYYY-MM-DD).');
    return {
      args: { ...args, priority: args.priority || 'MEDIUM' },
      summary: `Add reminder "${args.title}" due ${due.toDateString()}`,
      details: [
        { label: 'Title', value: args.title },
        { label: 'Type', value: args.type },
        { label: 'Due', value: due.toDateString() },
        { label: 'Priority', value: args.priority || 'MEDIUM' },
      ],
      warnings: due.getTime() < Date.now() - 86400000 ? ['That due date is in the past.'] : [],
    };
  },
  async execute(args, ctx) {
    const r = await ctx.prisma.client.reminder.create({ data: { title: args.title, type: args.type, dueDate: new Date(args.dueDate), priority: args.priority, status: 'PENDING' } });
    return { result: { created: r.title, dueDate: r.dueDate } };
  },
};

export const dismissReminder: WriteTool = {
  name: 'dismiss_reminder',
  kind: 'write',
  groups: ['reminder'],
  description: 'Mark a pending reminder as done.',
  schema: z.object({ reminder: z.string().describe('Reminder title or part of it') }),
  async prepare(args, ctx) {
    const matches = await ctx.prisma.client.reminder.findMany({ where: { status: 'PENDING', OR: [{ id: args.reminder }, { title: { contains: args.reminder } }] }, take: 5 });
    if (matches.length === 0) throw new ToolUserError(`No pending reminder matches "${args.reminder}".`);
    if (matches.length > 1) throw new ToolUserError(`Several reminders match: ${matches.map(m => `"${m.title}"`).join(', ')}. Which one?`);
    return { args: { id: matches[0].id }, summary: `Dismiss reminder "${matches[0].title}"`, details: [{ label: 'Reminder', value: matches[0].title }, { label: 'Due', value: matches[0].dueDate.toDateString() }] };
  },
  async execute(args, ctx) {
    await ctx.prisma.client.reminder.update({ where: { id: args.id }, data: { status: 'DISMISSED' } });
    return { result: { dismissed: true } };
  },
};

export const adjustStock: WriteTool = {
  name: 'adjust_stock',
  kind: 'write',
  roles: ['OWNER', 'MANAGER'],
  groups: ['stock'],
  description: 'Correct the stock count of a product (positive to add, negative to remove), e.g. after a physical count, damage or receiving goods.',
  schema: z.object({
    product: z.string(),
    quantityChange: z.number().refine(n => n !== 0, 'Change cannot be zero').describe('Units to add (positive) or remove (negative)'),
    reason: z.string().min(3).max(200),
  }),
  async prepare(args, ctx) {
    const p: any = await resolveProduct(ctx, args.product);
    const current = p.stockLevels[0]?.quantity ?? 0;
    const next = current + args.quantityChange;
    if (next < 0) throw new ToolUserError(`${p.name} has only ${current} in stock; cannot remove ${-args.quantityChange}.`);
    return {
      args: { productId: p.id, quantityChange: args.quantityChange, reason: args.reason },
      summary: `${args.quantityChange > 0 ? 'Add' : 'Remove'} ${Math.abs(args.quantityChange)} ${p.baseUnit.abbreviation} ${args.quantityChange > 0 ? 'to' : 'from'} ${p.name}`,
      details: [
        { label: 'Product', value: `${p.name} (${p.sku})` },
        { label: 'Stock', value: `${current} → ${next} ${p.baseUnit.abbreviation}` },
        { label: 'Reason', value: args.reason },
      ],
      warnings: Math.abs(args.quantityChange) > Math.max(50, current) ? ['This is a large change compared to current stock.'] : [],
    };
  },
  async execute(args, ctx) {
    const result: any = await ctx.products.adjustStock(args.productId, args.quantityChange, 'ADJUSTMENT', undefined, ctx.user.userId, args.reason);
    return { result: { newQuantity: result?.quantity ?? result?.stockLevel?.quantity ?? 'updated' }, uiAction: { type: 'refresh', what: 'products' } };
  },
};

export const updateProductPrices: WriteTool = {
  name: 'update_product_prices',
  kind: 'write',
  roles: ['OWNER', 'MANAGER'],
  groups: ['stock', 'product'],
  description: 'Change a product\'s MRP or price levels (level1 ideal, level2 default, level3 minimum, emergency floor). Only the owner can change cost price.',
  schema: z.object({
    product: z.string(),
    mrp: z.number().positive().optional(),
    level1Price: z.number().positive().optional(),
    level2Price: z.number().positive().optional(),
    level3Price: z.number().positive().optional(),
    emergencyPrice: z.number().positive().optional(),
    costPrice: z.number().positive().optional(),
  }),
  async prepare(args, ctx) {
    const p: any = await resolveProduct(ctx, args.product);
    const isOwner = ctx.user.role === 'OWNER';
    if (args.costPrice !== undefined && !isOwner) throw new ToolUserError('Only the owner can change cost prices.');
    const fields = ['mrp', 'level1Price', 'level2Price', 'level3Price', 'emergencyPrice'] as const;
    const next: Record<string, number> = {};
    for (const f of fields) next[f] = (args as any)[f] ?? p[f];
    if (fields.every(f => (args as any)[f] === undefined) && args.costPrice === undefined) throw new ToolUserError('No new price was given.');
    if (!(next.level1Price >= next.level2Price && next.level2Price >= next.level3Price && next.level3Price >= next.emergencyPrice)) {
      throw new ToolUserError(`Prices must go Level 1 ≥ Level 2 ≥ Level 3 ≥ Emergency (got ${next.level1Price} / ${next.level2Price} / ${next.level3Price} / ${next.emergencyPrice}).`);
    }
    const cost = args.costPrice ?? p.stockLevels[0]?.costPrice ?? 0;
    const warnings = next.level3Price < cost ? [`The minimum price is below cost${isOwner ? ` (${inr(cost)})` : ''}.`] : [];
    const label: Record<string, string> = { mrp: 'MRP', level1Price: 'Level 1', level2Price: 'Level 2 (default)', level3Price: 'Level 3 (minimum)', emergencyPrice: 'Emergency' };
    return {
      args: { productId: p.id, ...next, ...(args.costPrice !== undefined ? { costPrice: args.costPrice } : {}) },
      summary: `Update prices for ${p.name}`,
      details: [
        { label: 'Product', value: `${p.name} (${p.sku})` },
        ...fields.filter(f => (args as any)[f] !== undefined).map(f => ({ label: label[f], value: `${inr(p[f])} → ${inr(next[f])}` })),
        ...(args.costPrice !== undefined ? [{ label: 'Cost price', value: `${inr(p.stockLevels[0]?.costPrice)} → ${inr(args.costPrice)}` }] : []),
      ],
      warnings,
    };
  },
  async execute(args, ctx) {
    const p = await ctx.prisma.client.product.findUniqueOrThrow({ where: { id: args.productId } });
    // updateProduct overwrites identity fields, so pass the current ones through unchanged
    await ctx.products.updateProduct(args.productId, {
      name: p.name, sku: p.sku, barcode: p.barcode, rackLocation: p.rackLocation, hsnCode: p.hsnCode,
      mrp: args.mrp, level1Price: args.level1Price, level2Price: args.level2Price, level3Price: args.level3Price, emergencyPrice: args.emergencyPrice,
      ...(args.costPrice !== undefined ? { costPrice: args.costPrice } : {}),
    });
    await ctx.prisma.client.productPrice.updateMany({ where: { productId: args.productId, level: 'RETAIL' }, data: { price: args.level1Price } });
    await ctx.prisma.client.productPrice.updateMany({ where: { productId: args.productId, level: 'WHOLESALE' }, data: { price: args.level2Price } });
    return { result: { updated: p.name }, uiAction: { type: 'refresh', what: 'products' } };
  },
};

export const decideApproval: WriteTool = {
  name: 'decide_approval',
  kind: 'write',
  roles: ['OWNER', 'MANAGER'],
  groups: ['approval'],
  description: 'Approve or reject a bill that is waiting for price approval.',
  schema: z.object({
    billNumber: z.string(),
    decision: z.enum(['APPROVE', 'REJECT']),
    reason: z.string().max(200).optional(),
  }),
  async prepare(args, ctx) {
    const bill: any = await resolveBill(ctx, args.billNumber);
    const approval = bill.approvals.find((a: any) => a.status === 'PENDING');
    if (!approval) throw new ToolUserError(`Bill ${bill.billNumber} has no pending approval.`);
    const requiredRole = approval.actionDetails ? JSON.parse(approval.actionDetails).requiredRole : 'MANAGER';
    if (requiredRole === 'OWNER' && ctx.user.role !== 'OWNER') throw new ToolUserError('This is a loss sale; only the owner can decide it.');
    return {
      args: { approvalId: approval.id, billNumber: bill.billNumber, decision: args.decision, reason: args.reason },
      summary: `${args.decision === 'APPROVE' ? 'Approve' : 'Reject'} bill ${bill.billNumber} (${inr(bill.netAmount)})`,
      details: [
        { label: 'Bill', value: `${bill.billNumber} for ${bill.customer?.name || 'walk-in'}` },
        { label: 'Amount', value: inr(bill.netAmount) },
        { label: 'Request', value: approval.description },
        ...(args.reason ? [{ label: 'Reason', value: args.reason }] : []),
      ],
      warnings: args.decision === 'APPROVE' ? ['Approving deducts the items from stock.'] : [],
    };
  },
  async execute(args, ctx) {
    await ctx.billing.handleApprovalAction(args.approvalId, { action: args.decision, userId: ctx.user.userId, reason: args.reason });
    return { result: { billNumber: args.billNumber, decision: args.decision } };
  },
};

export const createSalesReturn: WriteTool = {
  name: 'create_sales_return',
  kind: 'write',
  groups: ['return'],
  description: 'Return items from a finalized bill. Refunds use the original bill price. Disposition: RETURN_TO_STOCK (resellable), DAMAGED, WARRANTY.',
  schema: z.object({
    billNumber: z.string(),
    items: z.array(z.object({
      product: z.string(),
      quantity: z.number().positive(),
      disposition: z.enum(['RETURN_TO_STOCK', 'DAMAGED', 'WARRANTY']).optional(),
    })).min(1).max(30),
    reason: z.string().min(3).max(200),
  }),
  async prepare(args, ctx) {
    const bill: any = await resolveBill(ctx, args.billNumber);
    if (bill.isQuote || bill.status !== 'FINALIZED') throw new ToolUserError(`Bill ${bill.billNumber} is ${bill.isQuote ? 'a quote' : bill.status.toLowerCase().replace('_', ' ')}; only finalized bills can be returned.`);
    const returned: Record<string, number> = {};
    for (const r of bill.salesReturns) for (const i of r.items) returned[i.productId] = (returned[i.productId] || 0) + i.quantity;

    const lines: any[] = [];
    let refund = 0;
    for (const item of args.items) {
      const q = item.product.toLowerCase();
      const line = bill.items.find((i: any) => i.product.name.toLowerCase().includes(q) || i.product.sku.toLowerCase() === q);
      if (!line) throw new ToolUserError(`"${item.product}" is not on bill ${bill.billNumber}. Items on it: ${bill.items.map((i: any) => i.product.name).join(', ')}.`);
      const remaining = line.quantity - (returned[line.productId] || 0);
      if (item.quantity > remaining) throw new ToolUserError(`Only ${remaining} of ${line.product.name} can still be returned from this bill.`);
      const unitPrice = r2(line.unitPrice - line.discount);
      const lineRefund = r2(item.quantity * unitPrice * (1 + (line.cgstRate + line.sgstRate) / 100));
      refund += lineRefund;
      lines.push({ productId: line.productId, name: line.product.name, quantity: item.quantity, unitPrice, disposition: item.disposition || 'RETURN_TO_STOCK', refund: lineRefund });
    }
    const ageDays = Math.floor((Date.now() - new Date(bill.createdAt).getTime()) / 86400000);
    return {
      args: { billId: bill.id, billNumber: bill.billNumber, reason: args.reason, items: lines.map(l => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, disposition: l.disposition })) },
      summary: `Return from ${bill.billNumber}: refund about ${inr(refund)}`,
      details: [
        { label: 'Bill', value: `${bill.billNumber} (${bill.customer?.name || 'walk-in'}, ${bill.paymentMethod})` },
        ...lines.map(l => ({ label: l.name, value: `${l.quantity} × ${inr(l.unitPrice)} + GST = ${inr(l.refund)} · ${l.disposition.replace(/_/g, ' ').toLowerCase()}` })),
        { label: 'Reason', value: args.reason },
      ],
      warnings: ageDays > 7 ? [`This bill is ${ageDays} days old; the store policy allows returns within 7 days.`] : [],
    };
  },
  async execute(args, ctx) {
    const result: any = await ctx.billing.createSalesReturn({ billId: args.billId, reason: args.reason, userId: ctx.user.userId, items: args.items });
    return { result: { returnNumber: result?.returnNumber, billNumber: args.billNumber } };
  },
};

export const recordCashMovement: WriteTool = {
  name: 'record_cash_movement',
  kind: 'write',
  roles: ['OWNER', 'MANAGER'],
  groups: ['cash'],
  description: 'Record cash put into (DEPOSIT) or taken out of (WITHDRAWAL) the drawer during an open day session.',
  schema: z.object({ type: z.enum(['DEPOSIT', 'WITHDRAWAL']), amount: money, notes: z.string().max(200).optional() }),
  async prepare(args, ctx) {
    const session = await ctx.prisma.client.daySession.findFirst({ where: { status: 'OPEN' } });
    if (!session) throw new ToolUserError('No day session is open; open one first.');
    return {
      args: { ...args, sessionId: session.id },
      summary: `${args.type === 'DEPOSIT' ? 'Add' : 'Withdraw'} ${inr(args.amount)} ${args.type === 'DEPOSIT' ? 'to' : 'from'} the cash drawer`,
      details: [{ label: 'Type', value: args.type }, { label: 'Amount', value: inr(args.amount) }, ...(args.notes ? [{ label: 'Notes', value: args.notes }] : [])],
    };
  },
  async execute(args, ctx) {
    await ctx.prisma.client.cashDrawerTransaction.create({ data: { sessionId: args.sessionId, type: args.type, amount: args.amount, notes: args.notes || '' } });
    return { result: { recorded: args.amount, type: args.type } };
  },
};

export const deletePendingBill: WriteTool = {
  name: 'delete_pending_bill',
  kind: 'write',
  roles: ['OWNER', 'MANAGER'],
  groups: ['bill', 'approval'],
  description: 'Delete a bill that is still pending approval or was rejected. Finalized bills cannot be deleted (use a return instead).',
  schema: z.object({ billNumber: z.string() }),
  async prepare(args, ctx) {
    const bill: any = await resolveBill(ctx, args.billNumber);
    if (bill.status !== 'PENDING_APPROVAL' && bill.status !== 'REJECTED') throw new ToolUserError(`Bill ${bill.billNumber} is ${bill.status.toLowerCase()}; only pending or rejected bills can be deleted.`);
    return { args: { billId: bill.id, billNumber: bill.billNumber }, summary: `Delete ${bill.status.toLowerCase().replace('_', ' ')} bill ${bill.billNumber}`, details: [{ label: 'Bill', value: bill.billNumber }, { label: 'Amount', value: inr(bill.netAmount) }], warnings: ['This cannot be undone.'] };
  },
  async execute(args, ctx) {
    await ctx.billing.deleteBill(args.billId);
    return { result: { deleted: args.billNumber } };
  },
};

export const WRITE_TOOLS: WriteTool[] = [
  createCustomer, createBill, recordCustomerPayment, recordSupplierPayment, addExpense, createReminder, dismissReminder,
  adjustStock, updateProductPrices, decideApproval, createSalesReturn, recordCashMovement, deletePendingBill,
];
