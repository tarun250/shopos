import { z } from 'zod';
import { ReadTool, ToolUserError, UiTool, WriteTool } from './types';
import { inr, resolveBill, resolveProduct, resolveSupplier } from './resolvers';

// Operations tools: day sessions, catalogue, suppliers, purchasing, GST and invoice sharing.

const r2 = (n: number) => Math.round(n * 100) / 100;
const money = z.number().min(0).max(10_000_000);

// ---------- Day session ----------

export const openDaySession: WriteTool = {
  name: 'open_day_session',
  kind: 'write',
  groups: ['cash', 'session'],
  description: 'Open the day/shift with the opening cash count in the drawer.',
  schema: z.object({ openingCash: money.describe('Cash counted in the drawer at opening'), notes: z.string().max(200).optional() }),
  async prepare(args, ctx) {
    if (await ctx.sessions.getActive()) throw new ToolUserError('A day session is already open; close it first.');
    return {
      args,
      summary: `Open the day with ${inr(args.openingCash)} in the drawer`,
      details: [{ label: 'Opened by', value: ctx.user.username }, { label: 'Opening cash', value: inr(args.openingCash) }, ...(args.notes ? [{ label: 'Notes', value: args.notes }] : [])],
    };
  },
  async execute(args, ctx) {
    const session = await ctx.sessions.open({ openingUser: ctx.user.username, openingCash: args.openingCash, openingNotes: args.notes });
    return { result: { opened: true, openingCash: session.openingCash } };
  },
};

export const closeDaySession: WriteTool = {
  name: 'close_day_session',
  kind: 'write',
  groups: ['cash', 'session'],
  description: 'Close the day/shift with the actual cash counted. Differences above the threshold go to the owner for approval.',
  schema: z.object({ actualCash: money.describe('Cash actually counted in the drawer now'), notes: z.string().max(300).optional() }),
  async prepare(args, ctx) {
    const session = await ctx.sessions.getActive();
    if (!session) throw new ToolUserError('No day session is open.');
    const expected = ctx.sessions.expectedCash(session.cashTransactions);
    const difference = args.actualCash - expected;
    const threshold = Number((await ctx.prisma.client.systemSetting.findUnique({ where: { key: 'cash_diff_threshold' } }))?.value || '500');
    return {
      args,
      summary: `Close the day: counted ${inr(args.actualCash)}, expected ${inr(expected)}`,
      details: [
        { label: 'Expected cash', value: inr(expected) },
        { label: 'Counted cash', value: inr(args.actualCash) },
        { label: 'Difference', value: `${difference >= 0 ? '+' : '−'}${inr(Math.abs(difference))}` },
        ...(args.notes ? [{ label: 'Notes', value: args.notes }] : []),
      ],
      warnings: Math.abs(difference) > threshold ? [`The difference is over ${inr(threshold)}, so the owner will need to approve this closing.`] : [],
    };
  },
  async execute(args, ctx) {
    const closed = await ctx.sessions.close({ actualCash: args.actualCash, closingNotes: args.notes });
    return { result: { status: closed.status, difference: closed.difference } };
  },
};

// ---------- Catalogue ----------

export const createProduct: WriteTool = {
  name: 'create_product',
  kind: 'write',
  roles: ['OWNER', 'MANAGER'],
  groups: ['product', 'stock', 'purchase'],
  description: 'Add a new product to the catalogue. Price levels are derived from cost and selling price unless given.',
  schema: z.object({
    name: z.string().min(3).max(120),
    category: z.string().describe('Existing category name'),
    unit: z.string().describe('Unit name or abbreviation, e.g. pc, m, kg, L, box'),
    costPrice: z.number().positive(),
    sellingPrice: z.number().positive().describe('Default selling price before GST (Level 2)'),
    mrp: z.number().positive().optional().describe('MRP including GST'),
    gstPercent: z.enum(['0', '5', '12', '18', '28']).describe('Total GST rate'),
    hsnCode: z.string().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    openingStock: z.number().min(0).optional(),
    minStock: z.number().min(0).optional(),
  }),
  async prepare(args, ctx) {
    const db = ctx.prisma.client;
    const category = await db.category.findFirst({ where: { isDeleted: false, name: { contains: args.category } } });
    if (!category) {
      const all = await db.category.findMany({ where: { isDeleted: false }, select: { name: true } });
      throw new ToolUserError(`No category "${args.category}". Categories: ${all.map(c => c.name).join(', ')}.`);
    }
    const unit = await db.unit.findFirst({ where: { OR: [{ abbreviation: args.unit }, { name: { contains: args.unit } }] } });
    if (!unit) {
      const all = await db.unit.findMany({ select: { name: true, abbreviation: true } });
      throw new ToolUserError(`No unit "${args.unit}". Units: ${all.map(u => `${u.name} (${u.abbreviation})`).join(', ')}.`);
    }
    if (args.sellingPrice <= args.costPrice) throw new ToolUserError('Selling price must be higher than cost price.');
    const sku = (args.sku || `${category.name.slice(0, 3)}-${args.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 8)}-${Date.now().toString(36).slice(-3)}`).toUpperCase();
    if (await db.product.findUnique({ where: { sku } })) throw new ToolUserError(`SKU ${sku} already exists.`);
    if (args.barcode && (await db.product.findUnique({ where: { barcode: args.barcode } }))) throw new ToolUserError(`Barcode ${args.barcode} is already used by another product.`);

    const gst = Number(args.gstPercent);
    const maxPreTax = args.mrp ? args.mrp / (1 + gst / 100) : Infinity;
    const level1 = r2(Math.min(args.sellingPrice * 1.08, maxPreTax));
    const level2 = r2(Math.min(args.sellingPrice, level1));
    const level3 = r2(Math.min(args.costPrice * 1.1, level2));
    const emergency = r2(Math.min(args.costPrice * 1.02, level3));
    const resolved = {
      name: args.name.trim(), sku, barcode: args.barcode, categoryId: category.id, baseUnitId: unit.id, hsnCode: args.hsnCode,
      cgstRate: gst / 2, sgstRate: gst / 2, igstRate: gst, mrp: args.mrp, costPrice: args.costPrice,
      level1Price: level1, level2Price: level2, level3Price: level3, emergencyPrice: emergency,
      minimumProfitPct: 10, openingStock: args.openingStock || 0, minStockLevel: args.minStock || 0,
    };
    return {
      args: resolved,
      summary: `Add product "${resolved.name}" (${sku})`,
      details: [
        { label: 'Category / unit', value: `${category.name} · ${unit.name}` },
        { label: 'Cost', value: inr(args.costPrice) },
        { label: 'Prices (L1 / L2 / L3 / floor)', value: `${inr(level1)} / ${inr(level2)} / ${inr(level3)} / ${inr(emergency)}` },
        ...(args.mrp ? [{ label: 'MRP', value: inr(args.mrp) }] : []),
        { label: 'GST', value: `${gst}%${args.hsnCode ? ` · HSN ${args.hsnCode}` : ''}` },
        { label: 'Opening stock', value: `${resolved.openingStock} ${unit.abbreviation} (min ${resolved.minStockLevel})` },
      ],
      warnings: args.hsnCode ? [] : ['No HSN code given; GST reports need one.'],
    };
  },
  async execute(args, ctx) {
    const product = await ctx.products.createProduct({ ...args, userId: ctx.user.userId });
    if (args.level1Price) {
      await ctx.prisma.client.productPrice.createMany({ data: [{ productId: product.id, level: 'RETAIL', price: args.level1Price }, { productId: product.id, level: 'WHOLESALE', price: args.level2Price }] });
    }
    ctx.rag.syncProducts(true).catch(() => undefined);
    return { result: { created: product.name, sku: product.sku }, uiAction: { type: 'refresh', what: 'products' } };
  },
};

export const createSupplier: WriteTool = {
  name: 'create_supplier',
  kind: 'write',
  roles: ['OWNER', 'MANAGER'],
  groups: ['supplier', 'purchase'],
  description: 'Register a new supplier.',
  schema: z.object({ name: z.string().min(2).max(100), phone: z.string(), companyName: z.string().optional(), gstin: z.string().optional(), address: z.string().max(250).optional() }),
  async prepare(args, ctx) {
    const phone = args.phone.replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) throw new ToolUserError('Phone number must have 10 digits.');
    const gstin = args.gstin?.toUpperCase().replace(/\s/g, '');
    if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gstin)) throw new ToolUserError(`"${args.gstin}" is not a valid GSTIN.`);
    const dup = await ctx.prisma.client.supplier.findFirst({ where: { isDeleted: false, OR: [{ name: args.name.trim() }, { phone }] } });
    if (dup) throw new ToolUserError(`A supplier already exists with that name or phone: ${dup.name}.`);
    return {
      args: { name: args.name.trim(), phone, companyName: args.companyName, gstin, address: args.address },
      summary: `Add supplier ${args.name.trim()}`,
      details: [{ label: 'Name', value: args.name.trim() }, { label: 'Phone', value: phone }, ...(args.companyName ? [{ label: 'Company', value: args.companyName }] : []), ...(gstin ? [{ label: 'GSTIN', value: gstin }] : [])],
    };
  },
  async execute(args, ctx) {
    const s = await ctx.prisma.client.supplier.create({ data: args as any });
    return { result: { created: s.name } };
  },
};

// ---------- Purchasing ----------

export const listPurchaseOrders: ReadTool = {
  name: 'list_purchase_orders',
  kind: 'read',
  roles: ['OWNER', 'MANAGER'],
  groups: ['purchase', 'supplier'],
  description: 'Recent purchase orders, optionally only open ones (not yet fully received) or for one supplier.',
  schema: z.object({ openOnly: z.boolean().optional(), supplier: z.string().optional() }),
  async execute(args, ctx) {
    const supplierId = args.supplier ? (await resolveSupplier(ctx, args.supplier)).id : undefined;
    const where: any = { ...(supplierId ? { supplierId } : {}), ...(args.openOnly ? { status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] } } : {}) };
    const rows = await ctx.prisma.client.purchaseOrder.findMany({ where, include: { supplier: { select: { name: true } }, items: { include: { product: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' }, take: 10 });
    return rows.map(p => ({
      poNumber: p.poNumber, supplier: p.supplier.name, date: p.createdAt, status: p.status, net: p.netAmount, unpaid: p.balanceAmount,
      items: p.items.map(i => `${i.product.name}: ${i.receivedQuantity}/${i.quantity} received`),
    }));
  },
};

export const reorderSuggestions: ReadTool = {
  name: 'reorder_suggestions',
  kind: 'read',
  roles: ['OWNER', 'MANAGER'],
  groups: ['purchase', 'stock', 'report'],
  description: 'What to reorder and how much, from the last 30 days of sales, current stock and open purchase orders, grouped by supplier.',
  schema: z.object({}),
  async execute(_args, ctx) {
    const r = await ctx.reports.reorder(7, 14, ctx.user.role);
    return r.bySupplier.map(g => ({
      supplier: g.supplier?.name || 'No supplier set',
      ...('estimatedCost' in g ? { estimatedCost: (g as any).estimatedCost } : {}),
      items: g.items.map(i => ({ product: i.name, stock: i.stock, minStock: i.minStock, soldLast30Days: i.soldLast30Days, onOrder: i.onOrder, suggestedQuantity: i.suggestedQuantity, urgent: i.urgent })),
    }));
  },
};

export const createPurchaseOrder: WriteTool = {
  name: 'create_purchase_order',
  kind: 'write',
  roles: ['OWNER', 'MANAGER'],
  groups: ['purchase', 'supplier'],
  description: 'Create a purchase order to a supplier. Set receiveNow=true when the goods have already arrived (e.g. entering a supplier invoice), which adds them to stock. Unit cost defaults to the last cost.',
  schema: z.object({
    supplier: z.string(),
    items: z.array(z.object({ product: z.string(), quantity: z.number().positive(), unitCost: z.number().positive().optional().describe('Cost per unit before GST') })).min(1).max(40),
    receiveNow: z.boolean().optional(),
    supplierInvoiceNumber: z.string().max(60).optional(),
    amountPaid: z.number().min(0).optional().describe('Amount paid to the supplier now, only with receiveNow'),
  }),
  async prepare(args, ctx) {
    const supplier = await resolveSupplier(ctx, args.supplier);
    const lines: any[] = [];
    const warnings: string[] = [];
    let net = 0;
    for (const item of args.items) {
      const p: any = await resolveProduct(ctx, item.product);
      if (lines.some(l => l.productId === p.id)) throw new ToolUserError(`${p.name} is listed twice; combine the quantities.`);
      const isOwner = ctx.user.role === 'OWNER';
      const lastCost = p.stockLevels[0]?.costPrice || 0;
      // Cost prices are owner-only: managers must state the supplier's rate themselves
      if (item.unitCost === undefined && !isOwner) throw new ToolUserError(`Give the unit cost for ${p.name} from the supplier's rate or invoice.`);
      const unitCost = item.unitCost ?? lastCost;
      if (!unitCost) throw new ToolUserError(`No previous cost for ${p.name}; give a unit cost.`);
      if (isOwner && lastCost && Math.abs(unitCost - lastCost) / lastCost > 0.15) warnings.push(`${p.name}: cost ${inr(unitCost)} differs from the last cost ${inr(lastCost)} by more than 15%.`);
      if (unitCost >= p.level3Price) warnings.push(`${p.name}: cost ${inr(unitCost)} is at or above the minimum selling price ${inr(p.level3Price)}; consider updating prices.`);
      const lineNet = r2(item.quantity * unitCost * (1 + (p.cgstRate + p.sgstRate) / 100));
      net += lineNet;
      lines.push({ productId: p.id, name: p.name, unit: p.baseUnit.abbreviation, quantity: item.quantity, unitCost, lineNet });
    }
    net = r2(net);
    if (args.amountPaid && !args.receiveNow) throw new ToolUserError('A payment can only be recorded when the goods are received now.');
    if ((args.amountPaid || 0) > net) throw new ToolUserError(`Payment ${inr(args.amountPaid)} is more than the order total ${inr(net)}.`);
    return {
      args: { supplierId: supplier.id, supplierName: supplier.name, items: lines.map(l => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost })), receiveNow: !!args.receiveNow, supplierInvoiceNumber: args.supplierInvoiceNumber, amountPaid: args.amountPaid || 0 },
      summary: `${args.receiveNow ? 'Record received purchase' : 'Create purchase order'} from ${supplier.name}: ${inr(net)}`,
      details: [
        { label: 'Supplier', value: supplier.name },
        ...lines.map(l => ({ label: l.name, value: `${l.quantity} ${l.unit} × ${inr(l.unitCost)} = ${inr(l.lineNet)} incl. GST` })),
        { label: 'Total', value: inr(net) },
        ...(args.supplierInvoiceNumber ? [{ label: 'Supplier invoice', value: args.supplierInvoiceNumber }] : []),
        { label: 'Stock', value: args.receiveNow ? 'Added to stock now' : 'Added when the goods are received' },
        ...(args.amountPaid ? [{ label: 'Paid now', value: inr(args.amountPaid) }] : []),
      ],
      warnings,
    };
  },
  async execute(args, ctx) {
    const po = await ctx.purchases.create({ supplierId: args.supplierId, items: args.items, supplierInvoiceNumber: args.supplierInvoiceNumber }, ctx.user.userId);
    if (args.receiveNow) {
      const received = await ctx.purchases.receive(po.id, { amountPaid: args.amountPaid, supplierInvoiceNumber: args.supplierInvoiceNumber }, ctx.user.userId);
      return { result: { poNumber: po.poNumber, status: received.status, total: po.netAmount }, uiAction: { type: 'refresh', what: 'products' } };
    }
    return { result: { poNumber: po.poNumber, status: po.status, total: po.netAmount } };
  },
};

export const receivePurchaseOrder: WriteTool = {
  name: 'receive_purchase_order',
  kind: 'write',
  roles: ['OWNER', 'MANAGER'],
  groups: ['purchase'],
  description: 'Receive goods against an open purchase order (all outstanding items, or specific quantities), adding them to stock.',
  schema: z.object({
    poNumber: z.string(),
    items: z.array(z.object({ product: z.string(), quantity: z.number().positive() })).optional().describe('Omit to receive everything outstanding'),
    amountPaid: z.number().min(0).optional(),
  }),
  async prepare(args, ctx) {
    const po = await ctx.purchases.get(args.poNumber).catch(() => null);
    if (!po) throw new ToolUserError(`No purchase order ${args.poNumber}.`);
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') throw new ToolUserError(`${po.poNumber} is already ${po.status.toLowerCase()}.`);
    const lines = (args.items?.length
      ? args.items.map(req => {
          const line = po.items.find(i => i.product.name.toLowerCase().includes(req.product.toLowerCase()) || i.product.sku.toLowerCase() === req.product.toLowerCase());
          if (!line) throw new ToolUserError(`"${req.product}" is not on ${po.poNumber}.`);
          if (req.quantity > line.quantity - line.receivedQuantity) throw new ToolUserError(`Only ${line.quantity - line.receivedQuantity} of ${line.product.name} are outstanding.`);
          return { line, quantity: req.quantity };
        })
      : po.items.filter(i => i.quantity > i.receivedQuantity).map(line => ({ line, quantity: line.quantity - line.receivedQuantity })));
    return {
      args: { id: po.id, poNumber: po.poNumber, items: lines.map(l => ({ productId: l.line.productId, quantity: l.quantity })), amountPaid: args.amountPaid || 0 },
      summary: `Receive goods on ${po.poNumber} from ${po.supplier.name}`,
      details: [...lines.map(l => ({ label: l.line.product.name, value: `${l.quantity} ${l.line.product.baseUnit.abbreviation} into stock` })), ...(args.amountPaid ? [{ label: 'Paid now', value: inr(args.amountPaid) }] : [])],
    };
  },
  async execute(args, ctx) {
    const po = await ctx.purchases.receive(args.id, { items: args.items, amountPaid: args.amountPaid }, ctx.user.userId);
    return { result: { poNumber: args.poNumber, status: po.status }, uiAction: { type: 'refresh', what: 'products' } };
  },
};

// ---------- GST & invoices ----------

export const gstSummary: ReadTool = {
  name: 'gst_summary',
  kind: 'read',
  roles: ['OWNER', 'MANAGER'],
  groups: ['report', 'gst'],
  description: 'GST working for a month: taxable sales, CGST/SGST by rate, B2B invoices, credit notes, input tax on purchases and estimated net payable.',
  schema: z.object({ month: z.string().optional().describe('YYYY-MM; defaults to the current month') }),
  async execute(args, ctx) {
    const g = await ctx.reports.gst(args.month);
    return { month: g.month, note: g.note, totals: g.totals, b2bInvoices: g.b2b.length, b2c: g.b2c, rateWise: g.rateWise, creditNotes: g.creditNotes.length, liability: g.liability };
  },
};

export const shareInvoice: UiTool = {
  name: 'share_invoice',
  kind: 'ui',
  groups: ['bill', 'share'],
  description: 'Print a bill (A4 GST invoice or thermal receipt) or open WhatsApp with the bill to send to the customer.',
  schema: z.object({ billNumber: z.string(), channel: z.enum(['whatsapp', 'print_a4', 'print_receipt']) }),
  async execute(args, ctx) {
    const bill: any = await resolveBill(ctx, args.billNumber);
    if (args.channel === 'whatsapp' && (!bill.customer || bill.customer.phone === '0000000000')) {
      throw new ToolUserError('This bill has no customer phone number; print it instead or add the customer first.');
    }
    return { result: { billNumber: bill.billNumber, channel: args.channel }, uiAction: { type: 'share_invoice', billId: bill.id, billNumber: bill.billNumber, channel: args.channel } };
  },
};

export const OPS_READ_TOOLS = [listPurchaseOrders, reorderSuggestions, gstSummary];
export const OPS_WRITE_TOOLS = [openDaySession, closeDaySession, createProduct, createSupplier, createPurchaseOrder, receivePurchaseOrder];
export const OPS_UI_TOOLS = [shareInvoice];
