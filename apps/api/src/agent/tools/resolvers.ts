import { ToolContext, ToolUserError } from './types';
import { tokenize } from '../rag/text';

// Turn what a person says ("the 9W bulb", "Gupta", "BILL-...") into exactly one record,
// or a clear error the model can relay so the user can disambiguate.

const listChoices = (items: string[]) => items.slice(0, 6).map(s => `"${s}"`).join(', ');

export async function resolveProduct(ctx: ToolContext, ref: string) {
  const db = ctx.prisma.client;
  const q = ref.trim();
  if (!q) throw new ToolUserError('No product was specified.');
  const include = { stockLevels: true, baseUnit: true, category: true, aliases: true, priceLevels: true };

  const exact = await db.product.findFirst({
    where: { isDeleted: false, OR: [{ id: q }, { sku: q }, { sku: q.toUpperCase() }, { barcode: q }, { aliases: { some: { aliasName: q.toLowerCase() } } }] },
    include,
  });
  if (exact) return exact;

  const byName = await db.product.findMany({
    where: { isDeleted: false, OR: [{ name: { contains: q } }, { sku: { contains: q } }, { aliases: { some: { aliasName: { contains: q.toLowerCase() } } } }] },
    include,
    take: 8,
  });
  const exactName = byName.find(p => p.name.toLowerCase() === q.toLowerCase());
  if (exactName) return exactName;
  if (byName.length === 1) return byName[0];

  // Word-level match: "philips 12w led bulbs" → the one product containing all those words
  const terms = [...new Set(tokenize(q))];
  if (terms.length > 0) {
    const candidates = byName.length > 1 ? byName : await db.product.findMany({
      where: { isDeleted: false, OR: terms.map(t => ({ name: { contains: t } })) },
      include,
      take: 60,
    });
    const scored = candidates
      .map(p => {
        const words = new Set(tokenize(`${p.name} ${p.sku} ${p.aliases.map(a => a.aliasName).join(' ')} ${p.category?.name || ''}`));
        return { p, score: terms.filter(t => words.has(t)).length / terms.length };
      })
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (best && best.score === 1 && (scored.length === 1 || scored[1].score < 1)) return best.p;
    if (best && best.score >= 0.75 && (scored.length === 1 || best.score - scored[1].score >= 0.25)) return best.p;
    const strong = scored.filter(s => s.score >= 0.5);
    if (strong.length > 1) {
      throw new ToolUserError(`"${ref}" matches several products: ${listChoices(strong.map(s => `${s.p.name} (${s.p.sku})`))}. Ask which one, or use the SKU.`);
    }
  }

  // Fall back to semantic search over the catalog
  const hits = await ctx.rag.search(q, { scope: 'PRODUCT', limit: 3, maxPerDocument: 1 }).catch(() => []);
  if (hits.length > 0) {
    const names = hits.map(h => h.title);
    throw new ToolUserError(`No product named "${ref}". Closest matches: ${listChoices(names)}. Ask the user which one they mean.`);
  }
  throw new ToolUserError(`No product found for "${ref}".`);
}

export async function resolveCustomer(ctx: ToolContext, ref: string) {
  const db = ctx.prisma.client;
  const q = ref.trim();
  if (!q) throw new ToolUserError('No customer was specified.');
  const digits = q.replace(/\D/g, '');

  const exact = await db.customer.findFirst({
    where: { isDeleted: false, OR: [{ id: q }, ...(digits.length >= 10 ? [{ phone: digits.slice(-10) }] : [])] },
  });
  if (exact) return exact;

  const matches = await db.customer.findMany({
    where: { isDeleted: false, OR: [{ name: { contains: q } }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])] },
    take: 8,
  });
  const exactName = matches.find(c => c.name.toLowerCase() === q.toLowerCase());
  if (exactName) return exactName;
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new ToolUserError(`"${ref}" matches several customers: ${listChoices(matches.map(c => `${c.name} (${c.phone})`))}. Ask which one.`);
  }
  throw new ToolUserError(`No customer found for "${ref}". They may need to be added first.`);
}

export async function resolveSupplier(ctx: ToolContext, ref: string) {
  const db = ctx.prisma.client;
  const q = ref.trim();
  const matches = await db.supplier.findMany({
    where: { isDeleted: false, OR: [{ id: q }, { name: { contains: q } }, { companyName: { contains: q } }, { phone: { contains: q } }] },
    take: 8,
  });
  const exactName = matches.find(s => s.name.toLowerCase() === q.toLowerCase());
  if (exactName) return exactName;
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new ToolUserError(`"${ref}" matches several suppliers: ${listChoices(matches.map(s => s.name))}. Ask which one.`);
  }
  throw new ToolUserError(`No supplier found for "${ref}".`);
}

export async function resolveBill(ctx: ToolContext, ref: string) {
  const q = ref.trim().toUpperCase();
  const db = ctx.prisma.client;
  const bill = await db.bill.findFirst({
    where: { OR: [{ id: ref.trim() }, { billNumber: q }] },
    include: { customer: true, items: { include: { product: true } }, approvals: true, salesReturns: { include: { items: true } } },
  });
  if (bill) return bill;
  const partial = await db.bill.findMany({ where: { billNumber: { contains: q } }, take: 6, orderBy: { createdAt: 'desc' } });
  if (partial.length === 1) return resolveBill(ctx, partial[0].id);
  if (partial.length > 1) throw new ToolUserError(`"${ref}" matches several bills: ${listChoices(partial.map(b => b.billNumber))}.`);
  throw new ToolUserError(`No bill found with number "${ref}".`);
}

/** Inclusive date range for a named period, in server local time. */
export function periodRange(period?: string, from?: string, to?: string): { gte?: Date; lt?: Date; label: string } {
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const today = startOfDay(new Date());
  const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
  switch (period) {
    case 'today': return { gte: today, label: 'today' };
    case 'yesterday': return { gte: daysAgo(1), lt: today, label: 'yesterday' };
    case 'week': return { gte: daysAgo(6), label: 'the last 7 days' };
    case 'month': return { gte: daysAgo(29), label: 'the last 30 days' };
    case 'this_month': { const d = new Date(today); d.setDate(1); return { gte: d, label: 'this calendar month' }; }
    case 'custom': {
      const gte = from ? startOfDay(new Date(from)) : undefined;
      const lt = to ? (() => { const d = startOfDay(new Date(to)); d.setDate(d.getDate() + 1); return d; })() : undefined;
      if ((gte && isNaN(gte.getTime())) || (lt && isNaN(lt.getTime()))) throw new ToolUserError('Dates must be in YYYY-MM-DD format.');
      return { gte, lt, label: `${from || 'the beginning'} to ${to || 'now'}` };
    }
    default: return { label: 'all time' };
  }
}

export const dateWhere = (r: { gte?: Date; lt?: Date }) =>
  r.gte || r.lt ? { createdAt: { ...(r.gte ? { gte: r.gte } : {}), ...(r.lt ? { lt: r.lt } : {}) } } : {};

export const inr = (n: number | null | undefined) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
