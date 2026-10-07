import { copyFileSync } from 'fs';
import { dirname, join } from 'path';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma.service';

/** A fresh copy of the migrated template database for one test file. */
export function createTestPrisma(name: string) {
  const template = process.env.SHOPOS_TEST_TEMPLATE_DB;
  if (!template) throw new Error('Template database missing; run tests through jest (globalSetup)');
  const file = join(dirname(template), `${name}-${Date.now()}.db`);
  copyFileSync(template, file);
  const client = new PrismaClient({ datasources: { db: { url: `file:${file}` } } });
  const prisma = { client } as unknown as PrismaService;
  return { client, prisma };
}

/** Minimal shop: three users, one warehouse, units, a category, two products, customers and a supplier. */
export async function seedShop(client: PrismaClient) {
  const hash = (v: string) => bcrypt.hashSync(v, 4); // low cost: tests only
  const owner = await client.user.create({ data: { username: 'owner', email: 'o@t.in', fullName: 'Owner', role: 'OWNER', passwordHash: hash('owner123'), pinHash: hash('1111') } });
  const manager = await client.user.create({ data: { username: 'manager', email: 'm@t.in', fullName: 'Manager', role: 'MANAGER', passwordHash: hash('manager123'), pinHash: hash('2222') } });
  const cashier = await client.user.create({ data: { username: 'cashier', email: 'c@t.in', fullName: 'Cashier', role: 'CASHIER', passwordHash: hash('cashier123'), pinHash: hash('3333') } });
  const warehouse = await client.warehouse.create({ data: { name: 'Main', code: 'WH-1' } });
  const pc = await client.unit.create({ data: { name: 'Piece', abbreviation: 'pc' } });
  const category = await client.category.create({ data: { name: 'Electricals' } });

  const makeProduct = (sku: string, name: string, cost: number, qty: number, min: number, l2: number, l3: number) =>
    client.product.create({
      data: {
        sku, name, baseUnitId: pc.id, categoryId: category.id, cgstRate: 9, sgstRate: 9, igstRate: 18, hsnCode: '85395200',
        mrp: l2 * 1.4, level1Price: l2 * 1.1, level2Price: l2, level3Price: l3, emergencyPrice: cost * 1.02,
        stockLevels: { create: { warehouseId: warehouse.id, quantity: qty, minStockLevel: min, costPrice: cost } },
      },
      include: { stockLevels: true },
    });
  const bulb = await makeProduct('LED-12W', 'Philips LED Bulb 12W B22', 95, 100, 10, 150, 110);
  const bulb9 = await makeProduct('LED-9W', 'Philips LED Bulb 9W B22', 75, 50, 10, 110, 90);

  const walkIn = await client.customer.create({ data: { name: 'Walk-In Customer', phone: '0000000000' } });
  const contractor = await client.customer.create({ data: { name: 'Gupta Electricals', phone: '9810011001', priceLevel: 'WHOLESALE', creditLimit: 5000, balance: 0 } });
  const supplier = await client.supplier.create({ data: { name: 'Havells Distribution', phone: '9811100201' } });

  return { owner, manager, cashier, warehouse, pc, category, bulb, bulb9, walkIn, contractor, supplier };
}
