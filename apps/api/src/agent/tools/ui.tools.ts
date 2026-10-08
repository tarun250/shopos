import { z } from 'zod';
import { ToolUserError, UiTool } from './types';
import { resolveBill, resolveCustomer, resolveProduct } from './resolvers';

// These tools act on the user's screen (navigation, POS cart). They change no stored data,
// so they run without confirmation; the browser carries them out.

export const PAGES = ['pos', 'inventory', 'order-history', 'purchases', 'reports', 'users', 'ai-quality', 'customer-ledgers', 'supplier-ledgers', 'returns', 'approvals', 'knowledge-base', 'settings'] as const;

export const navigate: UiTool = {
  name: 'navigate',
  kind: 'ui',
  groups: ['core'],
  description: 'Open a page of the app: pos (billing), inventory (products & stock), order-history, purchases (purchase orders, owner/manager), reports (owner/manager), users (owner), customer-ledgers, supplier-ledgers, returns, approvals, knowledge-base, settings (AI settings, owner only).',
  schema: z.object({ page: z.enum(PAGES) }),
  async execute(args, ctx) {
    if (args.page === 'approvals' && ctx.user.role === 'CASHIER') throw new ToolUserError('Cashiers cannot open the Approval Center.');
    if (args.page === 'settings' && ctx.user.role !== 'OWNER') throw new ToolUserError('Only the owner can open AI settings.');
    if (['knowledge-base', 'purchases', 'reports'].includes(args.page) && ctx.user.role === 'CASHIER') throw new ToolUserError(`Cashiers cannot open ${args.page}.`);
    if ((args.page === 'users' || args.page === 'ai-quality') && ctx.user.role !== 'OWNER') throw new ToolUserError('Only the owner can open that page.');
    return { result: { opened: args.page }, uiAction: { type: 'navigate', page: args.page } };
  },
};

export const openBill: UiTool = {
  name: 'open_bill',
  kind: 'ui',
  groups: ['bill', 'return'],
  description: 'Show a bill\'s full details on screen.',
  schema: z.object({ billNumber: z.string() }),
  async execute(args, ctx) {
    const bill = await resolveBill(ctx, args.billNumber);
    return { result: { opened: bill.billNumber }, uiAction: { type: 'open_bill', billNumber: bill.billNumber } };
  },
};

export const addToCart: UiTool = {
  name: 'add_to_cart',
  kind: 'ui',
  groups: ['bill'],
  description: 'Put a product into the POS billing cart on screen so the cashier can review and check out. Prefer this when the user is billing at the counter.',
  schema: z.object({ product: z.string(), quantity: z.number().positive().max(100000) }),
  async execute(args, ctx) {
    const p: any = await resolveProduct(ctx, args.product);
    const stock = p.stockLevels[0]?.quantity ?? 0;
    if (args.quantity > stock) throw new ToolUserError(`Only ${stock} ${p.baseUnit.abbreviation} of ${p.name} in stock.`);
    return { result: { added: p.name, quantity: args.quantity }, uiAction: { type: 'add_to_cart', productId: p.id, quantity: args.quantity, name: p.name } };
  },
};

export const setPosCustomer: UiTool = {
  name: 'set_pos_customer',
  kind: 'ui',
  groups: ['bill', 'customer'],
  description: 'Select the customer for the bill being prepared in the POS screen.',
  schema: z.object({ customer: z.string() }),
  async execute(args, ctx) {
    const c = await resolveCustomer(ctx, args.customer);
    return { result: { selected: c.name }, uiAction: { type: 'set_pos_customer', customerId: c.id, name: c.name } };
  },
};

export const UI_TOOLS: UiTool[] = [navigate, openBill, addToCart, setPosCustomer];
