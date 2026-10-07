import { BillingService } from '../src/billing/billing.service';
import { createTestPrisma, seedShop } from './helpers';

describe('BillingService (database)', () => {
  const { client, prisma } = createTestPrisma('billing');
  const billing = new BillingService(prisma);
  let shop: Awaited<ReturnType<typeof seedShop>>;

  beforeAll(async () => {
    shop = await seedShop(client);
  });
  afterAll(() => client.$disconnect());

  const stockOf = async (productId: string) => (await client.stockLevel.findFirst({ where: { productId } }))!.quantity;

  it('creates a finalized bill with correct GST and deducts stock', async () => {
    const before = await stockOf(shop.bulb.id);
    const bill: any = await billing.createBill({
      items: [{ productId: shop.bulb.id, quantity: 2, unitPrice: 150, discount: 0 }],
      discountAmount: 0, paymentMethod: 'CASH', paidAmount: 354, isQuote: false,
    }, shop.cashier.id);

    expect(bill.status).toBe('FINALIZED');
    expect(bill.totalAmount).toBe(300);
    expect(bill.cgstAmount).toBe(27);
    expect(bill.sgstAmount).toBe(27);
    expect(bill.netAmount).toBe(354);
    expect(await stockOf(shop.bulb.id)).toBe(before - 2);
  });

  it('holds below-minimum prices for approval without touching stock', async () => {
    const before = await stockOf(shop.bulb.id);
    const bill: any = await billing.createBill({
      items: [{ productId: shop.bulb.id, quantity: 1, unitPrice: 150, discount: 45 }], // sells at 105 < level3 110
      discountAmount: 0, paymentMethod: 'CASH', paidAmount: 123.9, isQuote: false,
    }, shop.cashier.id);

    expect(bill.status).toBe('PENDING_APPROVAL');
    expect(await stockOf(shop.bulb.id)).toBe(before);
    expect(await client.approval.count({ where: { billId: bill.id, status: 'PENDING' } })).toBe(1);
  });

  it('blocks credit sales over the customer credit limit', async () => {
    await expect(billing.createBill({
      customerId: shop.contractor.id,
      items: [{ productId: shop.bulb.id, quantity: 40, unitPrice: 150, discount: 0 }], // 7,080 > 5,000 limit
      discountAmount: 0, paymentMethod: 'CREDIT', paidAmount: 0, isQuote: false,
    }, shop.cashier.id)).rejects.toThrow(/CREDIT_LIMIT_BREACH/);
  });

  it('does not create the same offline bill twice', async () => {
    const input = {
      items: [{ productId: shop.bulb9.id, quantity: 1, unitPrice: 110, discount: 0 }],
      discountAmount: 0, paymentMethod: 'CASH', paidAmount: 129.8, isQuote: false,
      clientRef: 'offline-abc-1', offlineCreatedAt: '2026-10-08T10:00:00.000Z',
    };
    const first: any = await billing.createBill(input, shop.cashier.id);
    const before = await stockOf(shop.bulb9.id);
    const second: any = await billing.createBill(input, shop.cashier.id);

    expect(second.id).toBe(first.id);
    expect(second.duplicate).toBe(true);
    expect(await stockOf(shop.bulb9.id)).toBe(before);
    expect(first.offlineCreatedAt.toISOString()).toBe('2026-10-08T10:00:00.000Z');
  });

  it('customer payments reduce both the ledger and the stored balance', async () => {
    await billing.createBill({
      customerId: shop.contractor.id,
      items: [{ productId: shop.bulb.id, quantity: 10, unitPrice: 150, discount: 0 }],
      discountAmount: 0, paymentMethod: 'CREDIT', paidAmount: 0, isQuote: false,
    }, shop.cashier.id);
    expect((await client.customer.findUnique({ where: { id: shop.contractor.id } }))!.balance).toBe(1770);

    const entry = await billing.recordCustomerPayment(shop.contractor.id, { amount: 500, paymentMethod: 'CASH', userId: shop.cashier.id });
    expect(entry.runningBalance).toBe(1270);
    expect((await client.customer.findUnique({ where: { id: shop.contractor.id } }))!.balance).toBe(1270);
  });
});
