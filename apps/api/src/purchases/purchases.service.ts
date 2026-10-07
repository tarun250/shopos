import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface CreatePurchaseInput {
  supplierId: string;
  items: Array<{ productId: string; quantity: number; unitCost: number }>;
  expectedDate?: string;
  notes?: string;
  supplierInvoiceNumber?: string;
}

export interface ReceivePurchaseInput {
  /** Omit to receive everything still outstanding. */
  items?: Array<{ productId: string; quantity: number }>;
  updateCostPrice?: boolean;
  supplierInvoiceNumber?: string;
  amountPaid?: number;
  paymentMethod?: string;
}

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: { status?: string; supplierId?: string; search?: string; from?: string; to?: string; page?: number; take?: number }) {
    const take = Math.min(Math.max(filters.take || 25, 1), 100);
    const page = Math.max(filters.page || 1, 1);
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.from || filters.to) {
      where.createdAt = { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) };
    }
    const search = filters.search?.trim();
    if (search) {
      where.OR = [{ poNumber: { contains: search } }, { supplierInvoiceNumber: { contains: search } }, { supplier: { name: { contains: search } } }];
    }
    const [items, total] = await Promise.all([
      this.prisma.client.purchaseOrder.findMany({
        where,
        include: { supplier: { select: { id: true, name: true } }, _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.client.purchaseOrder.count({ where }),
    ]);
    return { items, total, page, take };
  }

  async get(idOrNumber: string) {
    const po = await this.prisma.client.purchaseOrder.findFirst({
      where: { OR: [{ id: idOrNumber }, { poNumber: idOrNumber.toUpperCase() }] },
      include: {
        supplier: true,
        items: { include: { product: { select: { id: true, name: true, sku: true, baseUnit: { select: { abbreviation: true } } } } } },
        supplierLedger: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!po) throw new NotFoundException(`Purchase order ${idOrNumber} not found`);
    return po;
  }

  async create(input: CreatePurchaseInput, userId: string) {
    if (!input.items?.length) throw new BadRequestException('A purchase order needs at least one item');
    const ids = input.items.map(i => i.productId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each product can appear only once; combine the quantities');
    for (const item of input.items) {
      if (!(item.quantity > 0)) throw new BadRequestException('Quantities must be greater than zero');
      if (!(item.unitCost >= 0)) throw new BadRequestException('Unit cost cannot be negative');
    }

    return this.prisma.client.$transaction(async tx => {
      const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, isDeleted: false } });
      if (!supplier) throw new NotFoundException('Supplier not found');
      const products = await tx.product.findMany({ where: { id: { in: ids }, isDeleted: false } });
      if (products.length !== ids.length) throw new NotFoundException('One or more products were not found');
      const byId = new Map(products.map(p => [p.id, p]));

      let total = 0, cgst = 0, sgst = 0;
      const lines = input.items.map(item => {
        const p = byId.get(item.productId)!;
        const base = r2(item.quantity * item.unitCost);
        const c = r2((base * p.cgstRate) / 100);
        const s = r2((base * p.sgstRate) / 100);
        total += base; cgst += c; sgst += s;
        return { productId: p.id, quantity: item.quantity, costPrice: item.unitCost, cgstRate: p.cgstRate, cgstAmount: c, sgstRate: p.sgstRate, sgstAmount: s, igstRate: 0, igstAmount: 0, totalPrice: r2(base + c + s) };
      });
      const net = r2(total + cgst + sgst);

      const poNumber = await this.nextPoNumber(tx);
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: supplier.id,
          totalAmount: r2(total),
          cgstAmount: r2(cgst),
          sgstAmount: r2(sgst),
          netAmount: net,
          balanceAmount: net,
          status: 'ORDERED',
          supplierInvoiceNumber: input.supplierInvoiceNumber || null,
          expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
          notes: input.notes || null,
          createdBy: userId,
          items: { create: lines },
        },
        include: { items: true, supplier: true },
      });
      await tx.auditLog.create({ data: { userId, action: 'CREATE_PURCHASE_ORDER', details: JSON.stringify({ poNumber, supplier: supplier.name, netAmount: net }) } });
      return po;
    });
  }

  /** Receives goods: stock up (weighted-average cost), supplier owed for what arrived, optional payment. */
  async receive(id: string, input: ReceivePurchaseInput, userId: string) {
    return this.prisma.client.$transaction(async tx => {
      const po = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true, supplier: true } });
      if (!po) throw new NotFoundException('Purchase order not found');
      if (po.status === 'CANCELLED' || po.status === 'RECEIVED') throw new BadRequestException(`This purchase order is already ${po.status.toLowerCase()}`);

      const requested = input.items?.length
        ? input.items
        : po.items.map(i => ({ productId: i.productId, quantity: i.quantity - i.receivedQuantity })).filter(i => i.quantity > 0);
      if (requested.length === 0) throw new BadRequestException('Nothing left to receive on this order');

      const warehouse = await tx.warehouse.findFirst();
      if (!warehouse) throw new BadRequestException('No warehouse is set up');

      let receivedValue = 0;
      for (const req of requested) {
        const line = po.items.find(i => i.productId === req.productId);
        if (!line) throw new BadRequestException('A received product is not on this purchase order');
        const remaining = line.quantity - line.receivedQuantity;
        if (!(req.quantity > 0) || req.quantity > remaining + 1e-9) {
          throw new BadRequestException(`Can receive at most ${remaining} more of this item`);
        }

        let stock = await tx.stockLevel.findFirst({ where: { productId: line.productId } });
        if (!stock) {
          stock = await tx.stockLevel.create({ data: { productId: line.productId, warehouseId: warehouse.id, quantity: 0, costPrice: line.costPrice } });
        }
        const newQty = stock.quantity + req.quantity;
        const newCost = input.updateCostPrice === false
          ? stock.costPrice
          : r2(((Math.max(stock.quantity, 0) * stock.costPrice) + req.quantity * line.costPrice) / (Math.max(stock.quantity, 0) + req.quantity));
        const updated = await tx.stockLevel.updateMany({
          where: { id: stock.id, version: stock.version },
          data: { quantity: newQty, costPrice: newCost, version: { increment: 1 } },
        });
        if (updated.count === 0) throw new ConflictException('Stock changed while receiving; please retry');
        await tx.inventoryHistory.create({
          data: { stockLevelId: stock.id, type: 'PURCHASE', quantityChanged: req.quantity, balanceQuantity: newQty, costPrice: line.costPrice, referenceId: po.id, userId },
        });
        await tx.purchaseItem.update({ where: { id: line.id }, data: { receivedQuantity: { increment: req.quantity } } });
        line.receivedQuantity += req.quantity;
        receivedValue += r2(req.quantity * line.costPrice * (1 + (line.cgstRate + line.sgstRate) / 100));
      }
      receivedValue = r2(receivedValue);

      // Supplier is owed for what actually arrived
      let balance = po.supplier.balance + receivedValue;
      await tx.supplierLedger.create({
        data: { supplierId: po.supplierId, purchaseOrderId: po.id, transactionType: 'PURCHASE', credit: receivedValue, runningBalance: r2(balance) },
      });

      const amountPaid = r2(Math.min(Math.max(input.amountPaid || 0, 0), po.balanceAmount));
      if (amountPaid > 0) {
        balance -= amountPaid;
        await tx.supplierLedger.create({
          data: { supplierId: po.supplierId, purchaseOrderId: po.id, transactionType: 'PAYMENT', debit: amountPaid, runningBalance: r2(balance) },
        });
      }
      await tx.supplier.update({ where: { id: po.supplierId }, data: { balance: r2(balance) } });

      const fullyReceived = po.items.every(i => i.receivedQuantity >= i.quantity - 1e-9);
      const paidAmount = r2(po.paidAmount + amountPaid);
      const result = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
          receivedAt: fullyReceived ? new Date() : po.receivedAt,
          supplierInvoiceNumber: input.supplierInvoiceNumber || po.supplierInvoiceNumber,
          paidAmount,
          balanceAmount: r2(Math.max(0, po.netAmount - paidAmount)),
        },
        include: { items: true, supplier: true },
      });
      await tx.auditLog.create({
        data: { userId, action: 'RECEIVE_PURCHASE_ORDER', details: JSON.stringify({ poNumber: po.poNumber, receivedValue, amountPaid, fullyReceived }) },
      });
      return result;
    });
  }

  async cancel(id: string, userId: string) {
    const po = await this.prisma.client.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.items.some(i => i.receivedQuantity > 0)) throw new BadRequestException('Goods have already been received on this order; it cannot be cancelled');
    if (po.status === 'CANCELLED') return po;
    const updated = await this.prisma.client.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED', balanceAmount: 0 } });
    await this.prisma.client.auditLog.create({ data: { userId, action: 'CANCEL_PURCHASE_ORDER', details: JSON.stringify({ poNumber: po.poNumber }) } });
    return updated;
  }

  /** Sequential per-year numbers: PO-2026-0001, PO-2026-0002, ... */
  private async nextPoNumber(tx: any): Promise<string> {
    const prefix = `PO-${new Date().getFullYear()}-`;
    const last = await tx.purchaseOrder.findFirst({ where: { poNumber: { startsWith: prefix } }, orderBy: { poNumber: 'desc' }, select: { poNumber: true } });
    const next = last ? Number(last.poNumber.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }
}
