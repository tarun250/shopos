// Adds realistic mock data on top of the base seed (users, settings and existing rows are kept).
// Run from packages/db: `npm run db:seed-mock`. Safe to run once; it exits if mock data already exists.
const { PrismaClient } = require('./index');

const prisma = new PrismaClient();

// Deterministic PRNG so every run produces the same dataset
let seed = 20261008;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const r2 = (n) => Math.round(n * 100) / 100;

const NOW = new Date();
function daysAgo(days, hour = 10, minute = 0) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, randInt(0, 59), 0);
  return d;
}
function daysAhead(days) {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d;
}
const ymd = (d) => d.toISOString().slice(2, 10).replace(/-/g, '');

const UNITS = [
  { name: 'Kilogram', abbreviation: 'kg' },
  { name: 'Litre', abbreviation: 'L' },
  { name: 'Set', abbreviation: 'set' },
  { name: 'Packet', abbreviation: 'pkt' },
];

const CATEGORIES = [
  { name: 'Plumbing', description: 'Pipes, fittings, taps, sealants' },
  { name: 'Paints & Adhesives', description: 'Enamels, primers, brushes, glues' },
  { name: 'Lubricants', description: 'Engine oils, greases, sprays' },
];

const SUPPLIERS = [
  { key: 'havells', name: 'Havells Distribution Centre', companyName: 'Havells India Ltd', phone: '9811100201', email: 'orders@havells-dist.in', gstin: '07AAACH0351E1ZB', address: 'Okhla Phase 2, New Delhi', creditLimit: 200000 },
  { key: 'bosch', name: 'Bosch Auto Parts Wholesale', companyName: 'Bosch Ltd', phone: '9811100202', email: 'trade@boschauto.in', gstin: '29AAACM9840P1ZT', address: 'Adugodi, Bengaluru', creditLimit: 150000 },
  { key: 'taparia', name: 'Sharma Hardware Traders', companyName: 'Sharma Traders', phone: '9811100203', email: 'sharma.traders@gmail.com', gstin: '09ABCPS1234K1Z5', address: 'Sadar Bazaar, Delhi', creditLimit: 80000 },
  { key: 'ashirvad', name: 'Aqua Plumbing Supplies', companyName: 'Ashirvad Pipes Pvt Ltd', phone: '9811100204', email: 'sales@aquaplumb.in', gstin: '09AAKCA5512M1ZQ', address: 'Sector 63, Noida', creditLimit: 100000 },
  { key: 'asian', name: 'Rangoli Paints & Chemicals', companyName: 'Rangoli Agencies', phone: '9811100205', email: 'rangoli.agencies@gmail.com', gstin: '09AAMFR7766B1ZD', address: 'Raj Nagar, Ghaziabad', creditLimit: 60000 },
];

// [sku, name, category, unit abbr, cost, mrp, gst%, hsn, finalStock, minStock, supplierKey, alias]
const PRODUCTS = [
  ['ELE-SW-6A', 'Havells Modular Switch 6A', 'Electricals', 'pc', 28, 55, 18, '85365090', 180, 30, 'havells', 'switch 6a'],
  ['ELE-SKT-16A', 'Anchor Roma Socket 16A', 'Electricals', 'pc', 65, 120, 18, '85366990', 95, 20, 'havells', 'power socket'],
  ['ELE-MCB-32', 'Havells MCB 32A Double Pole', 'Electricals', 'pc', 380, 690, 18, '85362030', 4, 10, 'havells', 'mcb 32'],
  ['ELE-BAT-20W', 'Syska LED Batten 20W', 'Electricals', 'pc', 210, 399, 18, '94051090', 42, 10, 'havells', 'tube light'],
  ['ELE-WIR-2.5', 'Finolex 2.5 Sqmm Copper Wire (Black)', 'Electricals', 'm', 15, 32, 18, '85444920', 650, 100, 'havells', 'wire 2.5'],
  ['ELE-FAN-1200', 'Crompton Ceiling Fan 1200mm', 'Electricals', 'pc', 1650, 2790, 18, '84145120', 7, 3, 'havells', 'ceiling fan'],
  ['ELE-LED-12W', 'Philips LED Bulb 12W B22', 'Electricals', 'pc', 95, 180, 18, '85395200', 140, 25, 'havells', 'bulb 12w'],
  ['ELE-TAPE-10', 'PVC Insulation Tape (Pack of 10)', 'Electricals', 'pkt', 45, 90, 18, '39191000', 60, 10, 'havells', 'black tape'],
  ['AUT-OF-SWF', 'Bosch Oil Filter (Maruti Swift)', 'Auto Spares', 'pc', 165, 320, 28, '84212300', 24, 8, 'bosch', 'swift oil filter'],
  ['AUT-BP-I20', 'Brake Pads Front Set (Hyundai i20)', 'Auto Spares', 'set', 980, 1750, 28, '87083000', 3, 5, 'bosch', 'i20 brake pad'],
  ['AUT-BAT-5AH', 'Exide Bike Battery 12V 5Ah', 'Auto Spares', 'pc', 1050, 1690, 28, '85071000', 9, 4, 'bosch', 'bike battery'],
  ['AUT-SPK-NGK', 'NGK Spark Plug CPR8E', 'Auto Spares', 'pc', 95, 180, 28, '85111000', 70, 15, 'bosch', 'ngk plug'],
  ['AUT-WIP-22', 'Wiper Blade 22 inch', 'Auto Spares', 'pc', 140, 299, 28, '85124000', 30, 6, 'bosch', 'wiper'],
  ['HRD-SD-6', 'Taparia Screwdriver Set (6 pc)', 'Hardware & Tools', 'set', 260, 450, 18, '82054000', 18, 5, 'taparia', 'screwdriver set'],
  ['HRD-HAM-450', 'Stanley Claw Hammer 450g', 'Hardware & Tools', 'pc', 310, 560, 18, '82052000', 12, 4, 'taparia', 'hammer'],
  ['HRD-DRL-500', 'Bosch GSB 500W Impact Drill', 'Hardware & Tools', 'pc', 2450, 3999, 18, '84672100', 2, 3, 'taparia', 'drill machine'],
  ['HRD-SCR-15', 'Wood Screw 1.5 inch (Box of 100)', 'Hardware & Tools', 'bx', 55, 110, 18, '73181200', 45, 10, 'taparia', 'wood screw'],
  ['HRD-TAP-5M', 'Freemans Measuring Tape 5m', 'Hardware & Tools', 'pc', 85, 175, 18, '90178010', 26, 6, 'taparia', 'measuring tape'],
  ['HRD-PLG-6', 'Nylon Wall Plug 6mm (Pack of 100)', 'Hardware & Tools', 'pkt', 30, 65, 18, '39269099', 80, 15, 'taparia', 'gitti'],
  ['PLB-CPVC-05', 'Ashirvad CPVC Pipe 1/2 inch (3m)', 'Plumbing', 'pc', 185, 320, 18, '39172390', 55, 10, 'ashirvad', 'cpvc pipe'],
  ['PLB-ELB-1', 'Supreme PVC Elbow 1 inch', 'Plumbing', 'pc', 12, 25, 18, '39174000', 300, 50, 'ashirvad', 'elbow'],
  ['PLB-TAP-BIB', 'Jaquar Bib Tap (Chrome)', 'Plumbing', 'pc', 520, 950, 18, '84818020', 0, 2, 'ashirvad', 'tap'],
  ['PLB-TEF-12', 'Teflon Tape 12mm', 'Plumbing', 'pc', 8, 20, 18, '39199090', 220, 40, 'ashirvad', 'teflon'],
  ['PNT-FEV-1KG', 'Fevicol SH 1kg', 'Paints & Adhesives', 'kg', 260, 395, 18, '35069999', 22, 6, 'asian', 'fevicol'],
  ['PNT-APC-1L', 'Asian Paints Apcolite Enamel 1L (White)', 'Paints & Adhesives', 'L', 330, 510, 18, '32089090', 16, 5, 'asian', 'white enamel'],
  ['PNT-MSEAL-100', 'M-Seal 100g', 'Paints & Adhesives', 'pc', 42, 75, 18, '32141000', 64, 12, 'asian', 'mseal'],
  ['PNT-BRS-2', 'Paint Brush 2 inch', 'Paints & Adhesives', 'pc', 35, 80, 18, '96034020', 38, 10, 'asian', 'brush'],
  ['LUB-WD40-170', 'WD-40 Multi-use Spray 170g', 'Lubricants', 'pc', 210, 345, 18, '34031900', 27, 6, 'bosch', 'wd40'],
  ['LUB-GRS-500', 'Servo Grease 500g', 'Lubricants', 'pc', 140, 240, 18, '34039900', 19, 5, 'bosch', 'grease'],
  ['LUB-CAS-4T', 'Castrol Activ 4T 20W-40 (1L)', 'Lubricants', 'L', 310, 450, 18, '27101980', 33, 8, 'bosch', 'engine oil'],
];

// [name, phone, priceLevel, creditLimit, openingBalance, gstin, address]
const CUSTOMERS = [
  ['Gupta Electricals', '9810011001', 'WHOLESALE', 100000, 12500, '09AAGFG1122H1Z1', 'Shop 14, Sector 18 Market, Noida'],
  ['Verma Auto Garage', '9810011002', 'CONTRACTOR', 60000, 4200, '09ABHPV3344J1Z2', 'NH-24, Vijay Nagar, Ghaziabad'],
  ['Singh Builders & Contractors', '9810011003', 'CONTRACTOR', 150000, 0, '09AAMFS5566K1Z3', 'Sector 76, Noida'],
  ['Khanna Plumbing Works', '9810011004', 'WHOLESALE', 40000, 0, null, 'Indirapuram, Ghaziabad'],
  ['Mehta Interiors', '9810011005', 'WHOLESALE', 75000, 8000, '07AAPFM7788L1Z4', 'Lajpat Nagar, New Delhi'],
  ['Priya Sharma', '9810011006', 'RETAIL', 0, 0, null, 'Sector 50, Noida'],
  ['Rahul Verma', '9810011007', 'RETAIL', 0, 0, null, 'Crossings Republik, Ghaziabad'],
  ['Amit Patel', '9810011008', 'RETAIL', 5000, 0, null, 'Sector 62, Noida'],
  ['Neha Kapoor', '9810011009', 'RETAIL', 0, 0, null, 'Vaishali, Ghaziabad'],
  ['Mohammed Irfan', '9810011010', 'RETAIL', 3000, 0, null, 'Sector 15, Noida'],
  ['Sunrise Facility Services', '9810011011', 'DISTRIBUTOR', 200000, 0, '09AAKCS9900M1Z5', 'Film City, Noida'],
  ['Deepak Yadav', '9810011012', 'RETAIL', 0, 0, null, 'Khora Colony, Noida'],
];

async function main() {
  const existing = await prisma.bill.findFirst({ where: { billNumber: { startsWith: 'BILL-M' } } });
  if (existing) {
    console.log('Mock data already present (found bill ' + existing.billNumber + '). Nothing to do.');
    return;
  }

  const users = await prisma.user.findMany();
  const byRole = (role) => users.find((u) => u.role === role);
  const owner = byRole('OWNER');
  const manager = byRole('MANAGER');
  const cashier = byRole('CASHIER');
  if (!owner || !manager || !cashier) {
    throw new Error('Base users missing. Run `npm run db:seed` first.');
  }
  const warehouse = await prisma.warehouse.findFirst();
  if (!warehouse) throw new Error('No warehouse found. Run `npm run db:seed` first.');

  await prisma.$transaction(async (tx) => {
    // ---------- Units & categories ----------
    for (const u of UNITS) {
      await tx.unit.upsert({ where: { name: u.name }, update: {}, create: u });
    }
    for (const c of CATEGORIES) {
      await tx.category.upsert({ where: { name: c.name }, update: {}, create: c });
    }
    const unitByAbbr = Object.fromEntries((await tx.unit.findMany()).map((u) => [u.abbreviation, u]));
    const catByName = Object.fromEntries((await tx.category.findMany()).map((c) => [c.name, c]));

    // ---------- Suppliers ----------
    const supplierByKey = {};
    for (const s of SUPPLIERS) {
      const { key, ...data } = s;
      supplierByKey[key] = await tx.supplier.create({ data: { ...data, createdAt: daysAgo(60) } });
    }

    // ---------- Customers ----------
    const walkIn = await tx.customer.findUnique({ where: { phone: '0000000000' } });
    const customers = [];
    for (const [name, phone, priceLevel, creditLimit, openingBalance, gstin, address] of CUSTOMERS) {
      const c = await tx.customer.create({
        data: { name, phone, priceLevel, creditLimit, balance: openingBalance, gstin, address, createdAt: daysAgo(45) },
      });
      if (openingBalance > 0) {
        await tx.customerLedger.create({
          data: { customerId: c.id, transactionType: 'OPENING_BALANCE', debit: openingBalance, runningBalance: openingBalance, createdAt: daysAgo(35, 9) },
        });
      }
      customers.push(c);
    }
    const tarun = await tx.customer.findUnique({ where: { phone: '9876543210' } });
    if (tarun) customers.push(tarun);
    const creditCustomers = customers.filter((c) => c.creditLimit > 0);

    // ---------- Products (stock is filled in after sales & purchases are known) ----------
    const catalog = []; // { product, stockLevel?, finalQty, minQty, cost, isNew }
    for (const [sku, name, cat, unit, cost, mrp, gst, hsn, finalQty, minQty, supKey, alias] of PRODUCTS) {
      const half = gst / 2;
      const minimumProfitPct = gst === 28 ? 15 : 12;
      const level1Price = Math.round(mrp * 0.92);
      const level2Price = Math.round(mrp * 0.85);
      const level3Price = Math.ceil(cost * (1 + minimumProfitPct / 100));
      const emergencyPrice = Math.ceil(cost * 1.03);
      const product = await tx.product.create({
        data: {
          sku, name, hsnCode: hsn, mrp,
          barcode: '890' + String(randInt(1000000000, 9999999999)),
          rackLocation: `Rack ${pick(['A', 'B', 'C', 'D', 'E'])}-${randInt(1, 6)}`,
          cgstRate: half, sgstRate: half, igstRate: gst,
          minimumProfitPct, level1Price, level2Price, level3Price, emergencyPrice,
          categoryId: catByName[cat].id,
          baseUnitId: unitByAbbr[unit].id,
          createdAt: daysAgo(40),
          priceLevels: {
            create: [
              { level: 'RETAIL', price: level1Price },
              { level: 'WHOLESALE', price: level2Price },
            ],
          },
          aliases: { create: [{ aliasName: alias }] },
          suppliers: { create: [{ supplierId: supplierByKey[supKey].id, isPrimary: true }] },
        },
      });
      catalog.push({ product, finalQty, minQty, cost, isNew: true, supKey });
    }
    // Existing seeded products take part in sales too
    const oldProducts = await tx.product.findMany({
      where: { sku: { in: ['ELE-LED-9W', 'AUT-SPK-M8', 'ELE-WIR-1.5', 'HRD-BLT-M8'] } },
      include: { stockLevels: true },
    });
    for (const p of oldProducts) {
      const sl = p.stockLevels[0];
      catalog.push({ product: p, stockLevel: sl, finalQty: null, minQty: sl.minStockLevel, cost: sl.costPrice, isNew: false });
      await tx.productPrice.createMany({
        data: [
          { productId: p.id, level: 'RETAIL', price: p.level1Price },
          { productId: p.id, level: 'WHOLESALE', price: p.level2Price },
        ],
      });
    }

    const qtyFor = (p) => {
      const unit = Object.values(unitByAbbr).find((u) => u.id === p.baseUnitId);
      if (unit?.abbreviation === 'm') return randInt(5, 30);
      if (p.sku === 'HRD-BLT-M8' || p.sku === 'PLB-ELB-1') return randInt(5, 40);
      if (p.level1Price > 1000) return 1;
      return randInt(1, 4);
    };
    const priceFor = (p, customer) => (!customer || customer.priceLevel === 'RETAIL' ? p.level1Price : p.level2Price);

    // ---------- Plan sales (in memory first, to size opening stock) ----------
    const soldQty = new Map(); // productId -> qty
    const plannedBills = [];
    // Low-stock / out-of-stock items stay mostly unsold so they keep their target levels
    const sellable = catalog.filter((c) => c.finalQty === null || c.finalQty > c.minQty || rand() < 0.3);
    let seq = 0;
    for (let day = 30; day >= 0; day--) {
      const billsToday = day === 0 ? randInt(3, 5) : randInt(1, 4);
      for (let b = 0; b < billsToday; b++) {
        const hour = day === 0 ? Math.min(NOW.getHours(), randInt(9, 20)) : randInt(9, 20);
        const createdAt = daysAgo(day, Math.max(9, hour), randInt(0, 59));
        if (createdAt > NOW) createdAt.setTime(NOW.getTime() - 60000 * randInt(5, 120));
        const isNamed = rand() < 0.55;
        const customer = isNamed ? pick(customers) : walkIn;
        const lineCount = randInt(1, 4);
        const chosen = new Set();
        const items = [];
        for (let i = 0; i < lineCount; i++) {
          const entry = pick(sellable);
          if (chosen.has(entry.product.id)) continue;
          chosen.add(entry.product.id);
          const quantity = qtyFor(entry.product);
          const unitPrice = priceFor(entry.product, isNamed ? customer : null);
          const discount = rand() < 0.15 ? r2(unitPrice * 0.03) : 0;
          items.push({ entry, quantity, unitPrice, discount });
          soldQty.set(entry.product.id, (soldQty.get(entry.product.id) || 0) + quantity);
        }
        seq++;
        plannedBills.push({
          billNumber: `BILL-M${ymd(createdAt)}-${String(seq).padStart(3, '0')}`,
          createdAt, customer: customer || null, items,
          user: pick([cashier, cashier, cashier, manager, owner]),
          billDiscount: rand() < 0.1 ? pick([10, 20, 50]) : 0,
        });
      }
    }
    plannedBills.sort((a, b) => a.createdAt - b.createdAt);

    // ---------- Plan purchases ----------
    const purchasedQty = new Map();
    const plannedPOs = [];
    let poSeq = 0;
    for (const [day, supKey] of [[28, 'havells'], [24, 'bosch'], [19, 'taparia'], [15, 'ashirvad'], [11, 'asian'], [6, 'havells'], [3, 'bosch']]) {
      const lines = catalog.filter((c) => c.isNew && c.supKey === supKey && c.finalQty > c.minQty);
      const items = lines.slice(0, randInt(2, Math.max(2, lines.length))).map((c) => {
        const quantity = c.product.level1Price > 1000 ? randInt(2, 5) : randInt(10, 60);
        purchasedQty.set(c.product.id, (purchasedQty.get(c.product.id) || 0) + quantity);
        return { entry: c, quantity };
      });
      poSeq++;
      plannedPOs.push({ poNumber: `PO-M${String(poSeq).padStart(3, '0')}`, supplier: supplierByKey[supKey], createdAt: daysAgo(day, 11), items });
    }

    // ---------- Opening stock for new products ----------
    for (const c of catalog) {
      if (!c.isNew) continue;
      const sold = soldQty.get(c.product.id) || 0;
      const bought = purchasedQty.get(c.product.id) || 0;
      let opening = c.finalQty + sold - bought;
      if (opening < 0) opening = 0; // purchases cover the difference
      c.stockLevel = await tx.stockLevel.create({
        data: { productId: c.product.id, warehouseId: warehouse.id, quantity: opening, minStockLevel: c.minQty, costPrice: c.cost, createdAt: daysAgo(35, 8) },
      });
      await tx.inventoryHistory.create({
        data: { stockLevelId: c.stockLevel.id, type: 'RECONCILIATION', quantityChanged: opening, balanceQuantity: opening, costPrice: c.cost, userId: owner.id, referenceId: 'OPENING_STOCK', createdAt: daysAgo(35, 8) },
      });
    }
    const stockQty = new Map(catalog.map((c) => [c.product.id, c.stockLevel.quantity]));
    const stockById = new Map(catalog.map((c) => [c.product.id, c.stockLevel]));

    // ---------- Build a single chronological event list ----------
    const events = [
      ...plannedPOs.map((po) => ({ at: po.createdAt, kind: 'PO', po })),
      ...plannedBills.map((bill) => ({ at: bill.createdAt, kind: 'BILL', bill })),
    ].sort((a, b) => a.at - b.at);

    const custBalance = new Map(customers.map((c) => [c.id, c.balance]));
    const lastLedgerAt = new Map(); // customerId -> Date of latest ledger entry
    const supBalance = new Map(Object.values(supplierByKey).map((s) => [s.id, 0]));
    const createdBills = [];

    for (const ev of events) {
      if (ev.kind === 'PO') {
        const { po } = ev;
        let total = 0, cgst = 0, sgst = 0;
        const items = po.items.map(({ entry, quantity }) => {
          const p = entry.product;
          const base = r2(quantity * entry.cost);
          const c = r2((base * p.cgstRate) / 100);
          const s = r2((base * p.sgstRate) / 100);
          total += base; cgst += c; sgst += s;
          return { productId: p.id, quantity, costPrice: entry.cost, cgstRate: p.cgstRate, cgstAmount: c, sgstRate: p.sgstRate, sgstAmount: s, igstRate: 0, igstAmount: 0, totalPrice: r2(base + c + s) };
        });
        const net = r2(total + cgst + sgst);
        const paid = rand() < 0.4 ? net : 0;
        const created = await tx.purchaseOrder.create({
          data: { poNumber: po.poNumber, supplierId: po.supplier.id, totalAmount: r2(total), cgstAmount: r2(cgst), sgstAmount: r2(sgst), netAmount: net, paidAmount: paid, balanceAmount: r2(net - paid), status: 'APPROVED', createdAt: po.createdAt, items: { create: items } },
        });
        let bal = supBalance.get(po.supplier.id) + net;
        await tx.supplierLedger.create({ data: { supplierId: po.supplier.id, purchaseOrderId: created.id, transactionType: 'PURCHASE', credit: net, runningBalance: r2(bal), createdAt: po.createdAt } });
        if (paid > 0) {
          bal -= paid;
          await tx.supplierLedger.create({ data: { supplierId: po.supplier.id, purchaseOrderId: created.id, transactionType: 'PAYMENT', debit: paid, runningBalance: r2(bal), createdAt: new Date(po.createdAt.getTime() + 3600000) } });
        }
        supBalance.set(po.supplier.id, r2(bal));
        for (const { entry, quantity } of po.items) {
          const q = stockQty.get(entry.product.id) + quantity;
          stockQty.set(entry.product.id, q);
          await tx.inventoryHistory.create({ data: { stockLevelId: stockById.get(entry.product.id).id, type: 'PURCHASE', quantityChanged: quantity, balanceQuantity: q, costPrice: entry.cost, userId: manager.id, referenceId: created.id, createdAt: po.createdAt } });
        }
        continue;
      }

      const { bill } = ev;
      // Drop lines that would take stock negative
      const items = bill.items.filter((it) => stockQty.get(it.entry.product.id) >= it.quantity);
      if (items.length === 0) continue;
      let preTax = 0, cgst = 0, sgst = 0;
      const lines = items.map(({ entry, quantity, unitPrice, discount }) => {
        const p = entry.product;
        const taxable = r2(quantity * (unitPrice - discount));
        const c = r2((taxable * p.cgstRate) / 100);
        const s = r2((taxable * p.sgstRate) / 100);
        preTax += taxable; cgst += c; sgst += s;
        return { productId: p.id, quantity, unitPrice, discount, cgstRate: p.cgstRate, cgstAmount: c, sgstRate: p.sgstRate, sgstAmount: s, igstRate: p.igstRate, igstAmount: 0, totalPrice: r2(taxable + c + s) };
      });
      const net = r2(Math.max(0, preTax + cgst + sgst - bill.billDiscount));

      const isNamed = bill.customer && bill.customer.id !== walkIn?.id;
      let method = pick(['CASH', 'CASH', 'CASH', 'UPI', 'UPI', 'CARD']);
      if (isNamed && bill.customer.creditLimit > 0 && rand() < 0.35) {
        const bal = custBalance.get(bill.customer.id) || 0;
        if (bal + net <= bill.customer.creditLimit) method = 'CREDIT';
      }
      const paid = method === 'CREDIT' ? 0 : net;
      const balanceAmount = r2(net - paid);

      const created = await tx.bill.create({
        data: {
          billNumber: bill.billNumber, customerId: bill.customer?.id || null,
          totalAmount: r2(preTax), discountAmount: bill.billDiscount, cgstAmount: r2(cgst), sgstAmount: r2(sgst), igstAmount: 0,
          netAmount: net, paidAmount: paid, balanceAmount, paymentMethod: method, userId: bill.user.id, status: 'FINALIZED', createdAt: bill.createdAt,
          items: { create: lines },
          payments: paid > 0 ? { create: [{ paymentMethod: method, amount: paid, transactionRef: method === 'CASH' ? null : `TXN${randInt(100000000, 999999999)}` }] } : undefined,
        },
      });
      createdBills.push({ ...created, items: lines });

      for (const it of items) {
        const q = stockQty.get(it.entry.product.id) - it.quantity;
        stockQty.set(it.entry.product.id, q);
        await tx.inventoryHistory.create({ data: { stockLevelId: stockById.get(it.entry.product.id).id, type: 'SALE', quantityChanged: -it.quantity, balanceQuantity: q, costPrice: it.entry.cost, userId: bill.user.id, referenceId: created.id, createdAt: bill.createdAt } });
      }

      if (method === 'CREDIT') {
        const bal = r2(custBalance.get(bill.customer.id) + balanceAmount);
        custBalance.set(bill.customer.id, bal);
        await tx.customerLedger.create({ data: { customerId: bill.customer.id, billId: created.id, transactionType: 'SALE', debit: balanceAmount, runningBalance: bal, createdAt: bill.createdAt } });
        lastLedgerAt.set(bill.customer.id, bill.createdAt);
      }

      await tx.auditLog.create({ data: { userId: bill.user.id, action: 'CREATE_BILL', details: JSON.stringify({ billId: created.id, billNumber: created.billNumber, netAmount: net, paymentMethod: method }), createdAt: bill.createdAt } });
    }

    // ---------- Customer payments against credit ----------
    for (const c of creditCustomers) {
      const bal = custBalance.get(c.id) || 0;
      if (bal < 1000 || rand() < 0.3) continue;
      const amount = Math.round((bal * pick([0.3, 0.5, 0.6])) / 100) * 100;
      const newBal = r2(bal - amount);
      custBalance.set(c.id, newBal);
      // Payment lands after the customer's latest credit sale so running balances stay in order
      const after = (lastLedgerAt.get(c.id) || daysAgo(5)).getTime() + randInt(2, 48) * 3600000;
      const paidAt = new Date(Math.min(after, NOW.getTime() - 60000));
      await tx.customerLedger.create({ data: { customerId: c.id, transactionType: 'PAYMENT', credit: amount, runningBalance: newBal, createdAt: paidAt } });
    }
    for (const [id, bal] of custBalance) {
      await tx.customer.update({ where: { id }, data: { balance: bal } });
    }

    // ---------- Supplier balances (keep Polycab's opening balance separately) ----------
    for (const [id, bal] of supBalance) {
      await tx.supplier.update({ where: { id }, data: { balance: bal } });
    }

    // ---------- Final stock quantities ----------
    for (const c of catalog) {
      await tx.stockLevel.update({ where: { id: c.stockLevel.id }, data: { quantity: stockQty.get(c.product.id), version: { increment: 1 } } });
    }

    // ---------- Quote ----------
    {
      const fan = catalog.find((c) => c.product.sku === 'ELE-FAN-1200').product;
      const mcb = catalog.find((c) => c.product.sku === 'ELE-MCB-32').product;
      const singh = customers.find((c) => c.phone === '9810011003');
      const lines = [[fan, 6], [mcb, 10]].map(([p, quantity]) => {
        const taxable = quantity * p.level2Price;
        const c = r2((taxable * p.cgstRate) / 100);
        return { productId: p.id, quantity, unitPrice: p.level2Price, discount: 0, cgstRate: p.cgstRate, cgstAmount: c, sgstRate: p.sgstRate, sgstAmount: c, igstRate: p.igstRate, igstAmount: 0, totalPrice: r2(taxable + 2 * c) };
      });
      const preTax = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      const tax = lines.reduce((s, l) => s + l.cgstAmount + l.sgstAmount, 0);
      await tx.bill.create({
        data: { billNumber: `QTE-M${ymd(daysAgo(2))}-001`, customerId: singh.id, totalAmount: preTax, cgstAmount: r2(tax / 2), sgstAmount: r2(tax / 2), netAmount: r2(preTax + tax), paymentMethod: 'CREDIT', isQuote: true, userId: manager.id, status: 'FINALIZED', createdAt: daysAgo(2, 15), items: { create: lines } },
      });
    }

    // ---------- Bills waiting for approval (stock not deducted until approved) ----------
    const pendingSpecs = [
      { sku: 'ELE-SKT-16A', qty: 20, customerPhone: '9810011001', hoursAgo: 1 },
      { sku: 'AUT-SPK-NGK', qty: 10, customerPhone: '9810011002', hoursAgo: 3 },
      { sku: 'PNT-FEV-1KG', qty: 4, customerPhone: '9810011005', hoursAgo: 26, status: 'REJECTED' },
    ];
    let pSeq = 0;
    for (const spec of pendingSpecs) {
      const entry = catalog.find((c) => c.product.sku === spec.sku);
      const p = entry.product;
      const customer = customers.find((c) => c.phone === spec.customerPhone);
      const finalPrice = spec.status === 'REJECTED' ? Math.floor(entry.cost * 0.95) : Math.floor((p.level3Price + entry.cost) / 2);
      const discount = r2(p.level2Price - finalPrice);
      const taxable = r2(spec.qty * finalPrice);
      const c = r2((taxable * p.cgstRate) / 100);
      const net = r2(taxable + 2 * c);
      const createdAt = new Date(NOW.getTime() - spec.hoursAgo * 3600000);
      const belowCost = finalPrice < entry.cost;
      const requiredRole = belowCost ? 'OWNER' : 'MANAGER';
      const reason = belowCost
        ? `Loss sale for ${p.name} (Selling: ₹${finalPrice.toFixed(2)}, Cost: ₹${entry.cost.toFixed(2)})`
        : `Price below Level 3 minimum for ${p.name} (Selling: ₹${finalPrice.toFixed(2)}, Minimum: ₹${p.level3Price.toFixed(2)})`;
      pSeq++;
      const bill = await tx.bill.create({
        data: {
          billNumber: `BILL-M${ymd(createdAt)}-P${pSeq}`, customerId: customer.id, totalAmount: taxable, cgstAmount: c, sgstAmount: c, netAmount: net, paidAmount: net, paymentMethod: 'UPI',
          userId: cashier.id, status: spec.status || 'PENDING_APPROVAL', createdAt,
          items: { create: [{ productId: p.id, quantity: spec.qty, unitPrice: p.level2Price, discount, cgstRate: p.cgstRate, cgstAmount: c, sgstRate: p.sgstRate, sgstAmount: c, igstRate: p.igstRate, igstAmount: 0, totalPrice: net }] },
        },
      });
      await tx.approval.create({
        data: {
          requesterId: cashier.id, approverId: spec.status === 'REJECTED' ? owner.id : null, module: 'PRICING', description: reason,
          status: spec.status || 'PENDING', billId: bill.id, createdAt,
          actionDetails: JSON.stringify({
            requiredRole,
            reason: spec.status === 'REJECTED' ? 'Below cost, not allowed' : reason,
            oldPrice: [{ productId: p.id, price: p.level2Price }],
            newPrice: [{ productId: p.id, price: finalPrice }],
          }),
        },
      });
      await tx.auditLog.create({ data: { userId: cashier.id, action: 'BILL_APPROVAL_REQUESTED', details: JSON.stringify({ billId: bill.id, billNumber: bill.billNumber, requiredRole, reason }), createdAt } });
    }

    // ---------- A couple of sales returns ----------
    const returnable = createdBills.filter((b) => b.paymentMethod !== 'CREDIT' && b.createdAt < daysAgo(3));
    for (let i = 0; i < 2 && i < returnable.length; i++) {
      const b = returnable[returnable.length - 1 - i * 3];
      const line = b.items[0];
      const qty = 1;
      const unitNet = line.unitPrice - line.discount;
      const c = r2((unitNet * line.cgstRate) / 100);
      const refund = r2(unitNet + 2 * c);
      const disposition = i === 0 ? 'RETURN_TO_STOCK' : 'DAMAGED';
      const createdAt = new Date(b.createdAt.getTime() + 2 * 86400000);
      const ret = await tx.salesReturn.create({
        data: {
          returnNumber: `RET-M${String(i + 1).padStart(3, '0')}`, billId: b.id, totalAmount: unitNet, cgstAmount: c, sgstAmount: c, netAmount: refund, userId: manager.id,
          reason: i === 0 ? 'Customer bought wrong size' : 'Defective piece', createdAt,
          items: { create: [{ productId: line.productId, quantity: qty, unitPrice: unitNet, refundAmount: refund, disposition, notes: i === 0 ? 'Unused, box intact' : 'Not working out of box' }] },
        },
      });
      if (disposition === 'RETURN_TO_STOCK') {
        const sl = stockById.get(line.productId);
        const q = stockQty.get(line.productId) + qty;
        stockQty.set(line.productId, q);
        await tx.stockLevel.update({ where: { id: sl.id }, data: { quantity: q, version: { increment: 1 } } });
        await tx.inventoryHistory.create({ data: { stockLevelId: sl.id, type: 'RETURN', quantityChanged: qty, balanceQuantity: q, costPrice: sl.costPrice, userId: manager.id, referenceId: ret.id, createdAt } });
      }
    }

    // ---------- Expenses ----------
    const expenseSpecs = [
      [29, 'RENT', 25000, 'Shop rent - monthly'], [27, 'ELECTRICITY', 4380, 'UPPCL bill'], [25, 'TEA', 180, 'Tea & snacks'],
      [22, 'TRANSPORT', 650, 'Tempo for Sector 76 delivery'], [18, 'MAINTENANCE', 1200, 'Shutter repair'], [15, 'TEA', 160, 'Tea & snacks'],
      [12, 'FUEL', 500, 'Delivery bike petrol'], [9, 'TRANSPORT', 450, 'Supplier pickup - Sadar Bazaar'], [6, 'TEA', 200, 'Tea & snacks'],
      [4, 'SALARY', 15000, 'Helper salary'], [2, 'CUSTOM', 350, 'Stationery & bill books'], [0, 'TEA', 120, 'Tea & snacks'],
    ];
    const expensesByDay = new Map();
    for (const [day, category, amount, notes] of expenseSpecs) {
      const e = await tx.expense.create({ data: { category, amount, notes, approvedBy: owner.username, isRecurring: ['RENT', 'SALARY', 'ELECTRICITY'].includes(category), createdAt: daysAgo(day, 13) } });
      expensesByDay.set(day, [...(expensesByDay.get(day) || []), e]);
    }

    // ---------- Closed day sessions for the last 7 days ----------
    for (let day = 7; day >= 1; day--) {
      const opening = daysAgo(day, 9, 30);
      const closing = daysAgo(day, 21, 0);
      const cashBills = createdBills.filter((b) => b.paymentMethod === 'CASH' && b.createdAt >= opening && b.createdAt <= closing);
      const smallExpenses = (expensesByDay.get(day) || []).filter((e) => e.amount < 2000);
      const openingCash = 2000;
      const cashIn = cashBills.reduce((s, b) => s + b.paidAmount, 0);
      const cashOut = smallExpenses.reduce((s, e) => s + e.amount, 0);
      const expectedCash = r2(openingCash + cashIn - cashOut);
      const difference = day === 3 ? -620 : pick([0, 0, 0, -10, 20, -50]);
      const status = Math.abs(difference) > 500 ? 'PENDING_APPROVAL' : 'CLOSED';
      await tx.daySession.create({
        data: {
          openingUser: pick(['owner', 'manager']), openingTime: opening, openingCash, openingCard: 0, openingUpi: 0, openingNotes: 'Float from safe',
          closingTime: closing, expectedCash, actualCash: r2(expectedCash + difference), difference, status,
          closingNotes: status === 'PENDING_APPROVAL' ? 'Short by ₹620, checking bills' : 'All good',
          aiSummary: `${cashBills.length} cash bills worth ₹${cashIn.toFixed(2)}; cash expenses ₹${cashOut.toFixed(2)}; drawer difference ₹${difference.toFixed(2)}.`,
          cashTransactions: {
            create: [
              { type: 'DEPOSIT', amount: openingCash, notes: 'Opening cash', createdAt: opening },
              ...cashBills.map((b) => ({ type: 'SALE', amount: b.paidAmount, referenceId: b.id, notes: b.billNumber, createdAt: b.createdAt })),
              ...smallExpenses.map((e) => ({ type: 'EXPENSE', amount: e.amount, referenceId: e.id, notes: `Expense [${e.category}]: ${e.notes}`, createdAt: e.createdAt })),
            ],
          },
        },
      });
    }

    // Today's cash sales go into the currently open session, if there is one
    const openSession = await tx.daySession.findFirst({ where: { status: 'OPEN' } });
    if (openSession) {
      const todayStart = daysAgo(0, 0, 0);
      for (const b of createdBills.filter((b) => b.paymentMethod === 'CASH' && b.createdAt >= todayStart)) {
        await tx.cashDrawerTransaction.create({ data: { sessionId: openSession.id, type: 'SALE', amount: b.paidAmount, referenceId: b.id, notes: b.billNumber, createdAt: b.createdAt } });
      }
    }

    // ---------- Reminders ----------
    const topDebtors = [...custBalance.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
    const reminderData = [
      { title: 'File GSTR-1 for last month', type: 'GST', dueDate: daysAhead(3), priority: 'HIGH', isRecurring: true },
      { title: 'File GSTR-3B and pay GST', type: 'GST', dueDate: daysAhead(12), priority: 'HIGH', isRecurring: true },
      { title: 'Pay Polycab Wire Distributors outstanding', type: 'SUPPLIER_DUE', dueDate: daysAhead(5), priority: 'MEDIUM' },
      { title: 'Renew trade licence (Noida Authority)', type: 'LICENSE', dueDate: daysAhead(40), priority: 'MEDIUM' },
      { title: 'Shop insurance renewal', type: 'INSURANCE', dueDate: daysAhead(55), priority: 'LOW' },
      ...topDebtors.map(([id, bal]) => ({
        title: `Collect ₹${bal.toFixed(0)} from ${customers.find((c) => c.id === id).name}`,
        type: 'CUSTOMER_DUE', dueDate: daysAhead(randInt(1, 7)), priority: bal > 10000 ? 'HIGH' : 'MEDIUM',
      })),
    ];
    for (const r of reminderData) {
      await tx.reminder.create({ data: r });
    }

    console.log(`Created: ${SUPPLIERS.length} suppliers, ${CUSTOMERS.length} customers, ${PRODUCTS.length} products, ${createdBills.length} bills, ${plannedPOs.length} purchase orders, ${pendingSpecs.length} approvals, 1 quote, 2 returns, ${expenseSpecs.length} expenses, 7 closed day sessions, ${reminderData.length} reminders.`);
  }, { timeout: 120000, maxWait: 20000 });
}

main()
  .catch((e) => {
    console.error('Error adding mock data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
