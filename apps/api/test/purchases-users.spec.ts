import { PurchasesService } from '../src/purchases/purchases.service';
import { UsersService } from '../src/users/users.service';
import { ReportsService } from '../src/reports/reports.service';
import { createTestPrisma, seedShop } from './helpers';

describe('Purchasing, reorder and user management (database)', () => {
  const { client, prisma } = createTestPrisma('purchases');
  const purchases = new PurchasesService(prisma);
  const users = new UsersService(prisma);
  const reports = new ReportsService(prisma);
  let shop: Awaited<ReturnType<typeof seedShop>>;

  beforeAll(async () => {
    shop = await seedShop(client);
  });
  afterAll(() => client.$disconnect());

  describe('purchase orders', () => {
    let poId: string;

    it('creates sequentially numbered orders with GST totals', async () => {
      const po = await purchases.create({ supplierId: shop.supplier.id, items: [{ productId: shop.bulb.id, quantity: 100, unitCost: 85 }] }, shop.manager.id);
      const second = await purchases.create({ supplierId: shop.supplier.id, items: [{ productId: shop.bulb9.id, quantity: 5, unitCost: 70 }] }, shop.manager.id);
      poId = po.id;
      expect(po.status).toBe('ORDERED');
      expect(po.netAmount).toBe(10030); // 8,500 + 18% GST
      expect(Number(second.poNumber.slice(-4))).toBe(Number(po.poNumber.slice(-4)) + 1);
    });

    it('partially receives: stock up, weighted-average cost, supplier owed for what arrived', async () => {
      const po = await purchases.receive(poId, { items: [{ productId: shop.bulb.id, quantity: 100 - 60 }] }, shop.manager.id);
      const stock = await client.stockLevel.findFirst({ where: { productId: shop.bulb.id } });
      const supplier = await client.supplier.findUnique({ where: { id: shop.supplier.id } });

      expect(po.status).toBe('PARTIALLY_RECEIVED');
      expect(stock!.quantity).toBe(140);
      expect(stock!.costPrice).toBeCloseTo((100 * 95 + 40 * 85) / 140, 2);
      expect(supplier!.balance).toBe(4012); // 40 × 85 × 1.18
    });

    it('refuses to receive more than was ordered', async () => {
      await expect(purchases.receive(poId, { items: [{ productId: shop.bulb.id, quantity: 61 }] }, shop.manager.id)).rejects.toThrow(/at most 60/);
    });

    it('receives the rest with a payment and cannot then be cancelled', async () => {
      const po = await purchases.receive(poId, { amountPaid: 5000 }, shop.manager.id);
      const supplier = await client.supplier.findUnique({ where: { id: shop.supplier.id } });
      expect(po.status).toBe('RECEIVED');
      expect(po.paidAmount).toBe(5000);
      expect(supplier!.balance).toBe(10030 - 5000);
      await expect(purchases.cancel(poId, shop.manager.id)).rejects.toThrow(/cannot be cancelled/);
    });
  });

  describe('reorder suggestions', () => {
    it('suggests stock for a product at its minimum, net of open orders', async () => {
      await client.stockLevel.updateMany({ where: { productId: shop.bulb9.id }, data: { quantity: 4 } });
      const result = await reports.reorder(7, 14);
      const row = result.items.find(i => i.productId === shop.bulb9.id)!;
      expect(row.urgent).toBe(true);
      expect(row.onOrder).toBe(5); // the open order from the first test
      expect(row.suggestedQuantity).toBe(1); // min 10 - stock 4 - on order 5
    });
  });

  describe('users', () => {
    it('never deactivates or demotes the last active owner', async () => {
      await expect(users.setActive(shop.owner.id, false, shop.manager.id)).rejects.toThrow(/at least one active owner/);
      await expect(users.update(shop.owner.id, { role: 'MANAGER' }, shop.manager.id)).rejects.toThrow(/at least one active owner/);
    });

    it('rejects an approver PIN already used by another manager or owner', async () => {
      await expect(users.create({ username: 'mgr2', fullName: 'Second Manager', email: 'm2@t.in', role: 'MANAGER', password: 'secret123', pin: '2222' }, shop.owner.id))
        .rejects.toThrow(/PIN is already used/);
    });

    it('deactivation revokes the user sessions', async () => {
      await client.userSession.create({ data: { userId: shop.cashier.id, refreshTokenHash: 'hash-1', expiresAt: new Date(Date.now() + 86400000) } });
      await users.setActive(shop.cashier.id, false, shop.owner.id);
      expect(await client.userSession.count({ where: { userId: shop.cashier.id, isRevoked: false } })).toBe(0);
      const listed = await users.list();
      expect(JSON.stringify(listed)).not.toMatch(/Hash/);
    });
  });
});
