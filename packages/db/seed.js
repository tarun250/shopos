const { PrismaClient } = require('./index');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function hashValue(value) {
  return bcrypt.hashSync(value, 12);
}

async function main() {
  console.log('Seeding database with Pricing Engine & DDD warehouse data...');

  // 1. Clear existing data
  await prisma.priceApprovalLog.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.approval.deleteMany({});
  await prisma.customerLedger.deleteMany({});
  await prisma.supplierLedger.deleteMany({});
  await prisma.paymentSplit.deleteMany({});
  await prisma.billItem.deleteMany({});
  await prisma.bill.deleteMany({});
  await prisma.purchaseItem.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.inventoryHistory.deleteMany({});
  await prisma.stockLevel.deleteMany({});
  await prisma.warehouse.deleteMany({});
  await prisma.productPrice.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.productAlias.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.productRelationship.deleteMany({});
  await prisma.productDocument.deleteMany({});
  await prisma.productFieldValue.deleteMany({});
  await prisma.categoryField.deleteMany({});
  await prisma.productTemplate.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.unitConversion.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Database cleaned.');

  // 2. Create Users
  const owner = await prisma.user.create({
    data: {
      username: 'owner',
      email: 'owner@shopos.com',
      fullName: 'Suresh Kumar (Owner)',
      passwordHash: hashValue('owner123'),
      pinHash: hashValue('1111'),
      role: 'OWNER',
    },
  });

  const manager = await prisma.user.create({
    data: {
      username: 'manager',
      email: 'manager@shopos.com',
      fullName: 'Ramesh Singh (Manager)',
      passwordHash: hashValue('manager123'),
      pinHash: hashValue('2222'),
      role: 'MANAGER',
    },
  });

  const cashier = await prisma.user.create({
    data: {
      username: 'cashier',
      email: 'cashier@shopos.com',
      fullName: 'Anil Cashier',
      passwordHash: hashValue('cashier123'),
      pinHash: hashValue('3333'),
      role: 'CASHIER',
    },
  });

  console.log('Users seeded.');

  // 3. Create Warehouse
  const primaryWarehouse = await prisma.warehouse.create({
    data: {
      name: 'Primary Warehouse',
      code: 'WH-001',
      address: 'Main Store Complex, G floor'
    }
  });

  console.log('Warehouse seeded.');

  // 4. Create Units
  const unitPc = await prisma.unit.create({
    data: { name: 'Piece', abbreviation: 'pc' },
  });
  const unitBox = await prisma.unit.create({
    data: { name: 'Box', abbreviation: 'bx' },
  });
  const unitMeter = await prisma.unit.create({
    data: { name: 'Meter', abbreviation: 'm' },
  });
  const unitRoll = await prisma.unit.create({
    data: { name: 'Roll', abbreviation: 'rl' },
  });

  console.log('Units seeded.');

  // 5. Create Unit Conversions
  await prisma.unitConversion.create({
    data: { fromUnitId: unitBox.id, toUnitId: unitPc.id, factor: 12.0 },
  });
  await prisma.unitConversion.create({
    data: { fromUnitId: unitRoll.id, toUnitId: unitMeter.id, factor: 100.0 },
  });

  console.log('Unit Conversions seeded.');

  // 6. Create Categories
  const catElectrical = await prisma.category.create({
    data: { name: 'Electricals', description: 'Wires, switches, LED bulbs, sockets' },
  });
  const catAutomobile = await prisma.category.create({
    data: { name: 'Auto Spares', description: 'Spark plugs, filters, brake pads' },
  });
  const catHardware = await prisma.category.create({
    data: { name: 'Hardware & Tools', description: 'Screws, bolts, hammers, drills' },
  });

  console.log('Categories seeded.');

  // 7. Create Customers
  const custWalkIn = await prisma.customer.create({
    data: {
      name: 'Walk-In Customer',
      phone: '0000000000',
      priceLevel: 'RETAIL',
    },
  });

  const custTarun = await prisma.customer.create({
    data: {
      name: 'Tarun Kumar',
      phone: '9876543210',
      email: 'tarun@gmail.com',
      address: 'Sector 62, Noida',
      priceLevel: 'WHOLESALE',
      creditLimit: 50000.0,
      balance: 1500.0,
    },
  });

  await prisma.customerLedger.create({
    data: {
      customerId: custTarun.id,
      transactionType: 'OPENING_BALANCE',
      debit: 1500.0,
      runningBalance: 1500.0,
    }
  });

  console.log('Customers seeded.');

  // 8. Create Suppliers
  const supPolycab = await prisma.supplier.create({
    data: {
      name: 'Polycab Wire Distributors',
      companyName: 'Polycab India Ltd',
      phone: '1800222444',
      email: 'sales@polycab.com',
      gstin: '27POLYC1234A1ZA',
      address: 'Lower Parel, Mumbai',
      balance: 25000.0,
    },
  });

  await prisma.supplierLedger.create({
    data: {
      supplierId: supPolycab.id,
      transactionType: 'OPENING_BALANCE',
      credit: 25000.0,
      runningBalance: 25000.0,
    }
  });

  console.log('Suppliers seeded.');

  // 9. Create Products & Warehouse Stock Levels
  const prodLed = await prisma.product.create({
    data: {
      sku: 'ELE-LED-9W',
      barcode: '8901234567890',
      name: 'Philips LED Bulb 9W B22',
      description: 'Cool day light energy saver LED bulb',
      rackLocation: 'Aisle 2, Row A',
      minimumProfitPct: 12.0,
      hsnCode: '85395200',
      cgstRate: 9.0,
      sgstRate: 9.0,
      igstRate: 18.0,
      mrp: 150.0,
      level1Price: 120.0,
      level2Price: 110.0,
      level3Price: 90.0,
      emergencyPrice: 80.0,
      categoryId: catElectrical.id,
      baseUnitId: unitPc.id,
      stockLevels: {
        create: {
          warehouseId: primaryWarehouse.id,
          quantity: 250,
          minStockLevel: 20,
          costPrice: 75.0,
        }
      }
    },
  });

  const prodSpark = await prisma.product.create({
    data: {
      sku: 'AUT-SPK-M8',
      barcode: '4047024001234',
      name: 'Bosch Super Spark Plug M8',
      description: 'High performance copper core spark plug',
      rackLocation: 'Shelf B-1',
      minimumProfitPct: 15.0,
      hsnCode: '85111000',
      cgstRate: 14.0,
      sgstRate: 14.0,
      igstRate: 28.0,
      mrp: 200.0,
      level1Price: 180.0,
      level2Price: 160.0,
      level3Price: 135.0,
      emergencyPrice: 120.0,
      categoryId: catAutomobile.id,
      baseUnitId: unitPc.id,
      stockLevels: {
        create: {
          warehouseId: primaryWarehouse.id,
          quantity: 120,
          minStockLevel: 15,
          costPrice: 110.0,
        }
      }
    },
  });

  const prodWire = await prisma.product.create({
    data: {
      sku: 'ELE-WIR-1.5',
      barcode: '8902345678901',
      name: 'Polycab 1.5 Sqmm Copper Wire (Red)',
      description: 'FR multi-strand single core copper cable 100m roll',
      rackLocation: 'Aisle 1, Rack D',
      minimumProfitPct: 10.0,
      hsnCode: '85444920',
      cgstRate: 9.0,
      sgstRate: 9.0,
      igstRate: 18.0,
      mrp: 20.0,
      level1Price: 15.0,
      level2Price: 13.5,
      level3Price: 11.0,
      emergencyPrice: 10.0,
      categoryId: catElectrical.id,
      baseUnitId: unitMeter.id,
      stockLevels: {
        create: {
          warehouseId: primaryWarehouse.id,
          quantity: 800,
          minStockLevel: 100,
          costPrice: 9.5,
        }
      }
    },
  });

  const prodBolt = await prisma.product.create({
    data: {
      sku: 'HRD-BLT-M8',
      barcode: '8903456789012',
      name: 'Hex Head Bolt M8 x 50mm (Mild Steel)',
      description: 'Fully threaded MS hex bolt',
      rackLocation: 'Bin 12, Row F',
      minimumProfitPct: 8.0,
      hsnCode: '73181500',
      cgstRate: 9.0,
      sgstRate: 9.0,
      igstRate: 18.0,
      mrp: 10.0,
      level1Price: 8.0,
      level2Price: 7.0,
      level3Price: 5.0,
      emergencyPrice: 4.0,
      categoryId: catHardware.id,
      baseUnitId: unitPc.id,
      stockLevels: {
        create: {
          warehouseId: primaryWarehouse.id,
          quantity: 1500,
          minStockLevel: 200,
          costPrice: 3.5,
        }
      }
    },
  });

  console.log('Products & StockLevels seeded.');

  // 10. Create initial inventory history logs
  const stockLevels = await prisma.stockLevel.findMany();
  for (const stock of stockLevels) {
    await prisma.inventoryHistory.create({
      data: {
        stockLevelId: stock.id,
        type: 'RECONCILIATION',
        quantityChanged: stock.quantity,
        balanceQuantity: stock.quantity,
        costPrice: stock.costPrice,
        userId: owner.id,
        referenceId: 'INITIAL_SEED',
      },
    });
  }

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding DB:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
