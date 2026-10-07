import { BillingService } from '../src/billing/billing.service';
import { ProductsService } from '../src/products/products.service';
import { PurchasesService } from '../src/purchases/purchases.service';
import { ReportsService } from '../src/reports/reports.service';
import { createBill, adjustStock, createCustomer } from '../src/agent/tools/write.tools';
import { createPurchaseOrder } from '../src/agent/tools/ops.tools';
import { resolveProduct } from '../src/agent/tools/resolvers';
import { canUse } from '../src/agent/tools';
import { ToolContext, ToolUserError } from '../src/agent/tools/types';
import { createTestPrisma, seedShop } from './helpers';

describe('agent tools (database)', () => {
  const { client, prisma } = createTestPrisma('agent-tools');
  let shop: Awaited<ReturnType<typeof seedShop>>;
  let ctx: (role: 'OWNER' | 'MANAGER' | 'CASHIER') => ToolContext;

  beforeAll(async () => {
    shop = await seedShop(client);
    const users = { OWNER: shop.owner, MANAGER: shop.manager, CASHIER: shop.cashier };
    ctx = role => ({
      user: { userId: users[role].id, username: users[role].username, role },
      conversationId: 'test',
      prisma,
      billing: new BillingService(prisma),
      products: new ProductsService(prisma),
      purchases: new PurchasesService(prisma),
      reports: new ReportsService(prisma),
      sessions: null as any,
      rag: { search: async () => [] } as any, // retrieval is not under test here
    });
  });
  afterAll(() => client.$disconnect());

  it('resolves products from natural wording', async () => {
    expect((await resolveProduct(ctx('CASHIER'), 'philips 12w led bulbs')).id).toBe(shop.bulb.id);
    await expect(resolveProduct(ctx('CASHIER'), 'philips bulb')).rejects.toThrow(/several products/);
  });

  it('create_bill previews exact totals and changes nothing until executed', async () => {
    const billsBefore = await client.bill.count();
    const preview = await createBill.prepare({ items: [{ product: 'LED-12W', quantity: 2 }], paymentMethod: 'CASH' }, ctx('CASHIER'));

    expect(preview.details.find(d => d.label === 'Net total')!.value).toBe('₹354.00');
    expect(preview.args.items).toEqual([{ productId: shop.bulb.id, quantity: 2, unitPrice: 150, discount: 0 }]);
    expect(await client.bill.count()).toBe(billsBefore);

    const { result } = await createBill.execute(preview.args, ctx('CASHIER'));
    expect((result as any).status).toBe('FINALIZED');
    expect(await client.bill.count()).toBe(billsBefore + 1);
  });

  it('create_bill warns about below-minimum prices and blocks overselling', async () => {
    const preview = await createBill.prepare({ items: [{ product: 'LED-12W', quantity: 1, unitPrice: 100 }], paymentMethod: 'CASH' }, ctx('CASHIER'));
    expect(preview.warnings!.join(' ')).toMatch(/below the minimum price/);
    expect(preview.warnings!.join(' ')).not.toMatch(/cost/); // cashiers never see cost

    await expect(createBill.prepare({ items: [{ product: 'LED-9W', quantity: 5000 }], paymentMethod: 'CASH' }, ctx('CASHIER'))).rejects.toThrow(ToolUserError);
  });

  it('role limits: cashiers cannot adjust stock or set credit limits', async () => {
    expect(canUse(adjustStock, 'CASHIER')).toBe(false);
    expect(canUse(adjustStock, 'MANAGER')).toBe(true);
    await expect(createCustomer.prepare({ name: 'New Co', phone: '9999911111', creditLimit: 5000 }, ctx('CASHIER'))).rejects.toThrow(/Only the owner/);
  });

  it('create_purchase_order with receiveNow adds stock only after execute', async () => {
    const stockBefore = (await client.stockLevel.findFirst({ where: { productId: shop.bulb9.id } }))!.quantity;
    const preview = await createPurchaseOrder.prepare({ supplier: 'Havells', items: [{ product: 'LED-9W', quantity: 20 }], receiveNow: true, amountPaid: 500 }, ctx('MANAGER'));
    expect(preview.args.items[0].unitCost).toBe(75); // defaults to last cost
    expect((await client.stockLevel.findFirst({ where: { productId: shop.bulb9.id } }))!.quantity).toBe(stockBefore);

    await createPurchaseOrder.execute(preview.args, ctx('MANAGER'));
    expect((await client.stockLevel.findFirst({ where: { productId: shop.bulb9.id } }))!.quantity).toBe(stockBefore + 20);
  });
});
