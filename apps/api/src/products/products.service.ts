import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(cursor?: string, take = 50, search?: string, includeDeleted = false) {
    const limit = Math.min(take || 50, 100);
    const whereClause: any = {
      isDeleted: includeDeleted ? undefined : false
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
        { aliases: { some: { aliasName: { contains: search } } } }
      ];
    }

    return this.prisma.client.product.findMany({
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: whereClause,
      include: {
        category: true,
        baseUnit: true,
        priceLevels: true,
        stockLevels: { include: { warehouse: true } },
        aliases: true,
        variants: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
      include: {
        category: true,
        baseUnit: true,
        priceLevels: true,
        stockLevels: { include: { warehouse: true } },
        aliases: true,
        variants: true,
      },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async getCategories() {
    return this.prisma.client.category.findMany({
      where: { isDeleted: false },
      orderBy: { name: 'asc' },
    });
  }

  async getUnits() {
    return this.prisma.client.unit.findMany({
      include: {
        conversions: {
          include: {
            toUnit: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createProduct(data: any) {
    return this.prisma.client.$transaction(async (tx) => {
      // 1. Create Base Product
      const product = await tx.product.create({
        data: {
          sku: data.sku,
          barcode: data.barcode || null,
          name: data.name,
          description: data.description || null,
          rackLocation: data.rackLocation || null,
          minimumProfitPct: Number(data.minimumProfitPct || 10.0),
          hsnCode: data.hsnCode || null,
          cgstRate: Number(data.cgstRate || 0.0),
          sgstRate: Number(data.sgstRate || 0.0),
          igstRate: Number(data.igstRate || 0.0),
          mrp: data.mrp ? Number(data.mrp) : null,
          level1Price: Number(data.level1Price || 0.0),
          level2Price: Number(data.level2Price || 0.0),
          level3Price: Number(data.level3Price || 0.0),
          emergencyPrice: Number(data.emergencyPrice || 0.0),
          categoryId: data.categoryId || null,
          baseUnitId: data.baseUnitId,
        }
      });

      // 2. Fetch or create default warehouse
      let warehouse = await tx.warehouse.findFirst();
      if (!warehouse) {
        warehouse = await tx.warehouse.create({
          data: { name: 'Primary Warehouse', code: 'WH-001' }
        });
      }

      // 3. Create StockLevel with opening stock
      const qty = Number(data.openingStock || 0.0);
      const cost = Number(data.costPrice || 0.0);
      
      const stockLevel = await tx.stockLevel.create({
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: qty,
          minStockLevel: Number(data.minStockLevel || 0.0),
          costPrice: cost,
        }
      });

      // 4. Create initial history log
      if (qty > 0) {
        await tx.inventoryHistory.create({
          data: {
            stockLevelId: stockLevel.id,
            type: 'ADJUSTMENT',
            quantityChanged: qty,
            balanceQuantity: qty,
            costPrice: cost,
            referenceId: 'OPENING_STOCK',
            userId: data.userId || 'SYSTEM',
          }
        });
      }

      // 5. Create variants if specified
      if (data.variants && Array.isArray(data.variants)) {
        for (const variant of data.variants) {
          await tx.productVariant.create({
            data: {
              productId: product.id,
              name: variant.name,
              sku: variant.sku,
              barcode: variant.barcode || null,
              price: Number(variant.price || 0.0)
            }
          });
        }
      }

      // 6. Log Audit Log
      await tx.auditLog.create({
        data: {
          userId: data.userId || 'SYSTEM',
          action: 'CREATE_PRODUCT',
          details: JSON.stringify({
            productId: product.id,
            sku: product.sku,
            name: product.name,
            openingStock: qty
          })
        }
      });

      return product;
    });
  }

  async adjustStock(productId: string, quantityChanged: number, type: string, costPrice: number | undefined, userId: string, reason: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let warehouse = await this.prisma.client.warehouse.findFirst();
    if (!warehouse) {
      warehouse = await this.prisma.client.warehouse.create({
        data: { name: 'Primary Warehouse', code: 'WH-001' }
      });
    }

    let stockLevel = await this.prisma.client.stockLevel.findUnique({
      where: { productId_warehouseId: { productId, warehouseId: warehouse.id } }
    });

    if (!stockLevel) {
      stockLevel = await this.prisma.client.stockLevel.create({
        data: { productId, warehouseId: warehouse.id, quantity: 0, costPrice: 0 }
      });
    }

    const finalQuantity = stockLevel.quantity + quantityChanged;
    if (finalQuantity < 0) {
      throw new BadRequestException('Insufficient inventory for this adjustment');
    }

    const finalCost = costPrice !== undefined ? costPrice : stockLevel.costPrice;

    // Use transaction to ensure consistency
    const result = await this.prisma.client.$transaction(async (tx) => {
      // 1. Update stock
      const updateResult = await tx.stockLevel.updateMany({
        where: { id: stockLevel.id, version: stockLevel.version },
        data: {
          quantity: finalQuantity,
          costPrice: finalCost,
          version: { increment: 1 }
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException('Concurrent stock update conflict occurred. Please retry.');
      }

      // 2. Add history log
      await tx.inventoryHistory.create({
        data: {
          stockLevelId: stockLevel.id,
          type: type as any,
          quantityChanged,
          balanceQuantity: finalQuantity,
          costPrice: finalCost,
          referenceId: 'ADJUSTMENT',
          userId,
        },
      });

      // 3. Log Audit
      await tx.auditLog.create({
        data: {
          userId,
          action: 'STOCK_ADJUSTMENT',
          details: JSON.stringify({
            productId,
            productName: product.name,
            oldQuantity: stockLevel.quantity,
            newQuantity: finalQuantity,
            quantityChanged,
            reason,
          }),
        },
      });

      return {
        id: stockLevel.id,
        productId,
        quantity: finalQuantity,
        costPrice: finalCost
      };
    });

    return result;
  }

  async updateProduct(id: string, data: any) {
    return this.prisma.client.$transaction(async (tx) => {
      // 1. Update basic details and pricing engine tiers
      const updated = await tx.product.update({
        where: { id },
        data: {
          name: data.name,
          sku: data.sku,
          barcode: data.barcode || null,
          rackLocation: data.rackLocation || null,
          hsnCode: data.hsnCode || null,
          cgstRate: data.cgstRate !== undefined ? Number(data.cgstRate) : undefined,
          sgstRate: data.sgstRate !== undefined ? Number(data.sgstRate) : undefined,
          minimumProfitPct: data.minimumProfitPct !== undefined ? Number(data.minimumProfitPct) : undefined,
          
          mrp: data.mrp !== undefined ? (data.mrp ? Number(data.mrp) : null) : undefined,
          level1Price: data.level1Price !== undefined ? Number(data.level1Price) : undefined,
          level2Price: data.level2Price !== undefined ? Number(data.level2Price) : undefined,
          level3Price: data.level3Price !== undefined ? Number(data.level3Price) : undefined,
          emergencyPrice: data.emergencyPrice !== undefined ? Number(data.emergencyPrice) : undefined,
        },
      });

      // 2. Update cost price inside stock level
      if (data.costPrice !== undefined) {
        await tx.stockLevel.updateMany({
          where: { productId: id },
          data: { costPrice: Number(data.costPrice) },
        });
      }

      return updated;
    });
  }

  async softDelete(id: string, userId: string) {
    const product = await this.prisma.client.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.client.product.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() }
    });

    await this.prisma.client.auditLog.create({
      data: {
        userId,
        action: 'SOFT_DELETE_PRODUCT',
        details: JSON.stringify({ productId: id, name: product.name })
      }
    });

    return { success: true };
  }

  async restore(id: string, userId: string) {
    const product = await this.prisma.client.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.client.product.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null }
    });

    await this.prisma.client.auditLog.create({
      data: {
        userId,
        action: 'RESTORE_PRODUCT',
        details: JSON.stringify({ productId: id, name: product.name })
      }
    });

    return { success: true };
  }
}
