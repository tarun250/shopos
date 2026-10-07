import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async getCustomers() {
    return this.prisma.client.customer.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getSuppliers() {
    return this.prisma.client.supplier.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createCustomer(data: { name: string; phone: string; email?: string; address?: string; priceLevel?: string; creditLimit?: number }) {
    const existing = await this.prisma.client.customer.findUnique({
      where: { phone: data.phone },
    });
    if (existing) {
      throw new BadRequestException('Customer with this phone number already exists');
    }
    return this.prisma.client.customer.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        priceLevel: data.priceLevel || 'RETAIL',
        creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : 0,
      },
    });
  }

  async createBill(data: {
    customerId?: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      discount: number; // discount per item
    }>;
    discountAmount: number; // overall bill discount
    paymentMethod: string; // CASH, UPI, CARD, CREDIT, SPLIT
    paidAmount: number;
    isQuote: boolean;
    paymentSplits?: Array<{
      paymentMethod: string;
      amount: number;
      transactionRef?: string;
    }>;
    approvedByManagerId?: string; // provided if overridden by manager PIN
    clientRef?: string; // idempotency key from the offline queue
    offlineCreatedAt?: string;
  }, userId: string) {
    // A retried offline sync must not create the same bill twice
    if (data.clientRef) {
      const existing = await this.prisma.client.bill.findUnique({ where: { clientRef: data.clientRef } });
      if (existing) return { ...existing, duplicate: true };
    }
    return this.prisma.client.$transaction(async (tx) => {
      // 1. Fetch products and customer
      const productIds = data.items.map(i => i.productId);
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { stockLevels: true },
      });

      const productsMap = new Map(dbProducts.map(p => [p.id, p]));
      
      let customer = null;
      if (data.customerId) {
        customer = await tx.customer.findUnique({ where: { id: data.customerId } });
        if (!customer) throw new NotFoundException('Customer not found');
      }

      let totalPreTax = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;
      const billingItems = [];

      let needsApproval = false;
      let requiredRole = 'MANAGER';
      let approvalReason = '';

      const requester = await tx.user.findUnique({ where: { id: userId } });

      for (const item of data.items) {
        const prod = productsMap.get(item.productId) as any;
        if (!prod) throw new NotFoundException(`Product not found: ${item.productId}`);

        const inv = prod.stockLevels[0];
        if (!inv) throw new BadRequestException(`No stock level record for product: ${prod.name}`);

        // Stock check (Quotes don't deduct stock)
        if (!data.isQuote && inv.quantity < item.quantity) {
          throw new BadRequestException(`Insufficient stock for ${prod.name}. Available: ${inv.quantity}, Required: ${item.quantity}`);
        }

        const finalSellPrice = item.unitPrice - item.discount;

        if (finalSellPrice <= 0) {
          throw new BadRequestException(`VALIDATION_ERROR: Selling price for ${prod.name} cannot be zero or negative.`);
        }

        // Loss Sale Detection: Selling Price <= Cost Price
        if (finalSellPrice <= inv.costPrice) {
          needsApproval = true;
          requiredRole = 'OWNER'; // Loss sale strictly requires Owner approval
          approvalReason = `Loss sale detected for ${prod.name} (Selling: ₹${finalSellPrice.toFixed(2)}, Cost: ₹${inv.costPrice.toFixed(2)})`;
        } else if (finalSellPrice < prod.level3Price && requiredRole !== 'OWNER') {
          // Below Level 3 limit -> requires Manager/Owner approval
          needsApproval = true;
          requiredRole = 'MANAGER';
          approvalReason = `Price below Level 3 minimum for ${prod.name} (Selling: ₹${finalSellPrice.toFixed(2)}, Minimum: ₹${prod.level3Price.toFixed(2)})`;
        }

        // Calculate Taxes
        const lineBase = item.quantity * item.unitPrice;
        const lineDiscount = item.quantity * item.discount;
        const lineTaxable = Math.max(0, lineBase - lineDiscount);

        const itemCgst = Number(((lineTaxable * prod.cgstRate) / 100).toFixed(2));
        const itemSgst = Number(((lineTaxable * prod.sgstRate) / 100).toFixed(2));
        const itemIgst = 0.0;

        const lineTotal = lineTaxable + itemCgst + itemSgst;

        totalPreTax += lineTaxable;
        totalCgst += itemCgst;
        totalSgst += itemSgst;
        billingItems.push({
          productId: prod.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          cgstRate: prod.cgstRate,
          cgstAmount: itemCgst,
          sgstRate: prod.sgstRate,
          sgstAmount: itemSgst,
          igstRate: prod.igstRate,
          igstAmount: itemIgst,
          totalPrice: lineTotal,
        });
      }

      // Owner Confirm Override Bypasses approvals
      const isOwnerBypass = requester?.role === 'OWNER' && (data as any).bypassLossWarning;
      if (isOwnerBypass) {
        needsApproval = false;
      }

      // Net calculations
      const subTotal = totalPreTax + totalCgst + totalSgst + totalIgst;
      const netAmount = Math.max(0, subTotal - data.discountAmount);
      const balanceAmount = Math.max(0, netAmount - data.paidAmount);

      // Credit limit validation (skip for pending approvals/quotes)
      const creditAmount = data.paymentMethod === 'CREDIT' ? balanceAmount : 0;
      if (creditAmount > 0 && customer && !needsApproval) {
        const potentialBalance = customer.balance + creditAmount;
        if (potentialBalance > customer.creditLimit) {
          throw new BadRequestException(`CREDIT_LIMIT_BREACH: Sale exceeds customer's credit limit. Current balance: ₹${customer.balance}, Credit limit: ₹${customer.creditLimit}.`);
        }
      }

      // Generate Bill Number
      const timestamp = Date.now().toString().slice(-6);
      const randStr = Math.floor(100 + Math.random() * 900).toString();
      const billNumber = data.isQuote ? `QTE-${timestamp}-${randStr}` : `BILL-${timestamp}-${randStr}`;

      // Create Bill
      const bill = await tx.bill.create({
        data: {
          billNumber,
          customerId: data.customerId || null,
          totalAmount: totalPreTax,
          discountAmount: data.discountAmount,
          cgstAmount: totalCgst,
          sgstAmount: totalSgst,
          igstAmount: totalIgst,
          netAmount,
          paidAmount: data.paidAmount,
          balanceAmount,
          paymentMethod: data.paymentMethod,
          isQuote: data.isQuote,
          userId,
          clientRef: data.clientRef || null,
          offlineCreatedAt: data.offlineCreatedAt && !isNaN(Date.parse(data.offlineCreatedAt)) ? new Date(data.offlineCreatedAt) : null,
          status: needsApproval ? 'PENDING_APPROVAL' : 'FINALIZED',
          items: {
            create: billingItems,
          },
          payments: data.paymentSplits ? {
            create: data.paymentSplits.map(s => ({
              paymentMethod: s.paymentMethod,
              amount: s.amount,
              transactionRef: s.transactionRef,
            })),
          } : undefined,
        },
      });

      // Handle Approvals workflow
      if (needsApproval) {
        await tx.approval.create({
          data: {
            requesterId: userId,
            module: 'PRICING',
            description: approvalReason,
            status: 'PENDING',
            billId: bill.id,
            actionDetails: JSON.stringify({
              requiredRole,
              reason: approvalReason,
              oldPrice: data.items.map(i => ({
                productId: i.productId,
                price: (productsMap.get(i.productId) as any).level2Price
              })),
              newPrice: data.items.map(i => ({
                productId: i.productId,
                price: i.unitPrice - i.discount
              }))
            })
          }
        });

        await tx.auditLog.create({
          data: {
            userId,
            action: 'BILL_APPROVAL_REQUESTED',
            details: JSON.stringify({
              billId: bill.id,
              billNumber,
              requiredRole,
              reason: approvalReason
            }),
          },
        });

        return bill;
      }

      // If approved or within bounds, execute inventory deductions and ledgers
      if (!data.isQuote) {
        for (const item of data.items) {
          const prod = productsMap.get(item.productId) as any;
          const inv = prod.stockLevels[0];
          const updatedQty = inv.quantity - item.quantity;

          const updateResult = await tx.stockLevel.updateMany({
            where: { id: inv.id, version: inv.version },
            data: {
              quantity: updatedQty,
              version: { increment: 1 }
            },
          });

          if (updateResult.count === 0) {
            throw new ConflictException('Concurrent stock update conflict occurred. Please retry.');
          }

          await tx.inventoryHistory.create({
            data: {
              stockLevelId: inv.id,
              type: 'SALE',
              quantityChanged: -item.quantity,
              balanceQuantity: updatedQty,
              costPrice: inv.costPrice,
              userId,
              referenceId: bill.id,
            },
          });
        }

        // Update Customer balance & Ledger if Credit sale
        if (customer && data.paymentMethod === 'CREDIT' && balanceAmount > 0) {
          const newBal = customer.balance + balanceAmount;
          await tx.customer.update({
            where: { id: customer.id },
            data: { balance: newBal },
          });

          await tx.customerLedger.create({
            data: {
              customerId: customer.id,
              billId: bill.id,
              transactionType: 'SALE',
              debit: balanceAmount,
              credit: 0.0,
              runningBalance: newBal,
            },
          });
        }
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: isOwnerBypass ? 'OWNER_LOSS_OVERRIDE' : (data.isQuote ? 'CREATE_QUOTE' : 'CREATE_BILL'),
          details: JSON.stringify({
            billId: bill.id,
            billNumber,
            netAmount,
            customerId: data.customerId,
            lossOverrideBypassed: isOwnerBypass
          }),
        },
      });

      return bill;
    });
  }

  async listBills(filters: {
    search?: string;
    status?: string;
    paymentMethod?: string;
    from?: string;
    to?: string;
    page?: number;
    take?: number;
  }) {
    const take = Math.min(Math.max(filters.take || 25, 1), 100);
    const page = Math.max(filters.page || 1, 1);

    const where: any = {};
    if (filters.status === 'QUOTE') {
      where.isQuote = true;
    } else {
      where.isQuote = false;
      if (filters.status) where.status = filters.status;
    }
    if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }
    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { billNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } },
      ];
    }

    const [bills, total, totals, users] = await Promise.all([
      this.prisma.client.bill.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          _count: { select: { items: true, salesReturns: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.client.bill.count({ where }),
      this.prisma.client.bill.aggregate({
        where: { ...where, status: where.status || 'FINALIZED' },
        _sum: { netAmount: true, paidAmount: true, balanceAmount: true },
        _count: true,
      }),
      this.prisma.client.user.findMany({ select: { id: true, fullName: true } }),
    ]);
    const userNames = new Map(users.map(u => [u.id, u.fullName]));

    return {
      items: bills.map(b => ({ ...b, userName: userNames.get(b.userId) || 'Unknown' })),
      total,
      page,
      take,
      summary: {
        count: totals._count,
        netTotal: totals._sum.netAmount || 0,
        paidTotal: totals._sum.paidAmount || 0,
        balanceTotal: totals._sum.balanceAmount || 0,
      },
    };
  }

  async getBillDetail(idOrNumber: string) {
    const bill = await this.prisma.client.bill.findFirst({
      where: { OR: [{ id: idOrNumber }, { billNumber: idOrNumber }] },
      include: {
        customer: true,
        items: { include: { product: { include: { baseUnit: true } } } },
        payments: true,
        salesReturns: { include: { items: true }, orderBy: { createdAt: 'asc' } },
        approvals: {
          orderBy: { createdAt: 'desc' },
          include: {
            requester: { select: { fullName: true, role: true } },
            approver: { select: { fullName: true, role: true } },
          },
        },
      },
    });
    if (!bill) throw new NotFoundException(`Bill ${idOrNumber} not found`);

    const user = await this.prisma.client.user.findUnique({ where: { id: bill.userId }, select: { fullName: true } });
    const returnedQty: Record<string, number> = {};
    for (const r of bill.salesReturns) {
      for (const item of r.items) {
        returnedQty[item.productId] = (returnedQty[item.productId] || 0) + item.quantity;
      }
    }
    return { ...bill, userName: user?.fullName || 'Unknown', returnedQty };
  }

  async getApprovals() {
    return this.prisma.client.approval.findMany({
      include: {
        requester: { select: { username: true, fullName: true, role: true } },
        approver: { select: { username: true, fullName: true, role: true } },
        bill: { include: { items: { include: { product: true } } } },
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getBillStatus(id: string) {
    const bill = await this.prisma.client.bill.findUnique({
      where: { id },
      select: {
        status: true,
        approvals: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            approver: { select: { fullName: true } }
          }
        }
      }
    });
    if (!bill) throw new NotFoundException('Bill not found');

    let reason = '';
    let approverName = '';
    if (bill.approvals.length > 0) {
      try {
        const details = JSON.parse(bill.approvals[0].actionDetails || '{}');
        reason = details.reason || '';
        approverName = bill.approvals[0].approver?.fullName || '';
      } catch (e) {}
    }

    return { status: bill.status, reason, approverName };
  }

  async deleteBill(id: string) {
    const bill = await this.prisma.client.bill.findUnique({ where: { id } });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.status !== 'PENDING_APPROVAL' && bill.status !== 'REJECTED') {
      throw new BadRequestException('Only pending or rejected bills can be deleted');
    }
    await this.prisma.client.bill.delete({ where: { id } });
    return { success: true };
  }

  async handleApprovalAction(approvalId: string, data: { action: 'APPROVE' | 'REJECT', userId: string, reason?: string }) {
    return this.prisma.client.$transaction(async (tx) => {
      const approval = await tx.approval.findUnique({
        where: { id: approvalId },
        include: { bill: { include: { items: { include: { product: { include: { stockLevels: true } } } } } } }
      });

      if (!approval) throw new NotFoundException('Approval request not found');
      if (approval.status !== 'PENDING') {
        throw new BadRequestException(`Approval is already in ${approval.status} status`);
      }

      const bill = approval.bill;
      if (!bill) throw new NotFoundException('Associated bill not found');

      const approver = await tx.user.findUnique({ where: { id: data.userId } });
      if (!approver) throw new NotFoundException('Approver user not found');

      const actionDetails = approval.actionDetails ? JSON.parse(approval.actionDetails) : {};
      const requiredRole = actionDetails.requiredRole || 'MANAGER';
      if (requiredRole === 'OWNER' && approver.role !== 'OWNER') {
        throw new BadRequestException('Unauthorized: Only an Owner can approve this request');
      }

      if (data.action === 'APPROVE') {
        await tx.approval.update({
          where: { id: approvalId },
          data: {
            status: 'APPROVED',
            approverId: data.userId,
            actionDetails: JSON.stringify({ ...actionDetails, reason: data.reason || 'Approved' }),
          }
        });

        await tx.bill.update({
          where: { id: bill.id },
          data: { status: 'FINALIZED' }
        });

        for (const item of bill.items) {
          const inv = item.product.stockLevels[0];
          if (!inv) throw new BadRequestException(`No stock level record for product: ${item.product.name}`);
          
          const updatedQty = inv.quantity - item.quantity;
          if (updatedQty < 0) {
            throw new BadRequestException(`Insufficient stock for product ${item.product.name} to approve this bill.`);
          }

          const updateResult = await tx.stockLevel.updateMany({
            where: { id: inv.id, version: inv.version },
            data: {
              quantity: updatedQty,
              version: { increment: 1 }
            }
          });

          if (updateResult.count === 0) {
            throw new ConflictException('Concurrent stock update conflict occurred. Please retry.');
          }

          await tx.inventoryHistory.create({
            data: {
              stockLevelId: inv.id,
              type: 'SALE',
              quantityChanged: -item.quantity,
              balanceQuantity: updatedQty,
              costPrice: inv.costPrice,
              userId: approval.requesterId,
              referenceId: bill.id,
            }
          });

          const finalSellPrice = item.unitPrice - item.discount;
          if (finalSellPrice < item.product.level3Price) {
            const requesterUser = await tx.user.findUnique({ where: { id: approval.requesterId } });
            await tx.priceApprovalLog.create({
              data: {
                billNumber: bill.billNumber,
                productId: item.product.id,
                productName: item.product.name,
                requestedBy: requesterUser ? requesterUser.fullName : 'System Biller',
                approvedBy: approver.fullName,
                oldPrice: item.product.level2Price,
                newPrice: finalSellPrice,
                reason: approval.description,
              }
            });
          }
        }

        if (bill.customerId && bill.paymentMethod === 'CREDIT') {
          const customer = await tx.customer.findUnique({ where: { id: bill.customerId } });
          if (customer) {
            const newBal = customer.balance + bill.balanceAmount;
            await tx.customer.update({
              where: { id: customer.id },
              data: { balance: newBal }
            });

            await tx.customerLedger.create({
              data: {
                customerId: customer.id,
                billId: bill.id,
                transactionType: 'SALE',
                debit: bill.balanceAmount,
                credit: 0.0,
                runningBalance: newBal,
              }
            });
          }
        }

        await tx.auditLog.create({
          data: {
            userId: data.userId,
            action: 'APPROVE_PRICING_REQUEST',
            details: JSON.stringify({
              billId: bill.id,
              billNumber: bill.billNumber,
              requestedBy: approval.requesterId,
              approvedBy: data.userId,
            })
          }
        });

      } else {
        // REJECT
        await tx.approval.update({
          where: { id: approvalId },
          data: {
            status: 'REJECTED',
            approverId: data.userId,
            actionDetails: JSON.stringify({ ...actionDetails, reason: data.reason || 'Rejected' }),
          }
        });

        await tx.bill.update({
          where: { id: bill.id },
          data: { status: 'REJECTED' }
        });

        await tx.auditLog.create({
          data: {
            userId: data.userId,
            action: 'REJECT_PRICING_REQUEST',
            details: JSON.stringify({
              billId: bill.id,
              billNumber: bill.billNumber,
              requestedBy: approval.requesterId,
              rejectedBy: data.userId,
              reason: data.reason,
            })
          }
        });
      }

      return { success: true };
    });
  }

  // ==========================================
  // Returns Module
  // ==========================================

  async createSalesReturn(data: any) {
    const { billId, reason, userId, items } = data;

    return await this.prisma.client.$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({
        where: { id: billId },
        include: { customer: true, items: true }
      });
      if (!bill) throw new NotFoundException('Bill not found');

      if (!items || items.length === 0) {
        throw new BadRequestException('No items provided for return');
      }

      // Query existing returns for this bill
      const existingReturns = await tx.salesReturn.findMany({
        where: { billId },
        include: { items: true }
      });

      // Map existing returned quantities by productId
      const returnedQtyMap = new Map<string, number>();
      existingReturns.forEach(ret => {
        ret.items.forEach(retItem => {
          const prev = returnedQtyMap.get(retItem.productId) || 0;
          returnedQtyMap.set(retItem.productId, prev + retItem.quantity);
        });
      });

      const previouslyRefunded = existingReturns.reduce((acc, r) => acc + r.netAmount, 0);

      // Generate a return number
      const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

      let subtotal = 0;
      let cgst = 0;
      let sgst = 0;

      // Create return record
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNumber,
          billId,
          totalAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          netAmount: 0,
          userId,
          reason,
        }
      });

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { stockLevels: true }
        });
        if (!product) throw new NotFoundException(`Product ${item.productId} not found`);

        if (item.quantity <= 0) {
          throw new BadRequestException(`Invalid return quantity: ${item.quantity}`);
        }

        const originalItem = bill.items.find(bi => bi.productId === item.productId);
        if (!originalItem) {
          throw new BadRequestException(`Product ${item.productId} was not part of the original bill.`);
        }

        const alreadyReturned = returnedQtyMap.get(item.productId) || 0;
        if (alreadyReturned + item.quantity > originalItem.quantity) {
          throw new BadRequestException(
            `Cannot return quantity ${item.quantity}. Already returned: ${alreadyReturned}, Max allowed: ${originalItem.quantity}`
          );
        }

        const lineTotal = item.unitPrice * item.quantity;
        const lineCgst = Number(((lineTotal * originalItem.cgstRate) / 100).toFixed(2));
        const lineSgst = Number(((lineTotal * originalItem.sgstRate) / 100).toFixed(2));
        const lineRefund = lineTotal + lineCgst + lineSgst;

        subtotal += lineTotal;
        cgst += lineCgst;
        sgst += lineSgst;

        await tx.salesReturnItem.create({
          data: {
            salesReturnId: salesReturn.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            refundAmount: lineRefund,
            disposition: item.disposition, // "RETURN_TO_STOCK", "DAMAGED", "WARRANTY", "REJECTED"
            notes: item.notes
          }
        });

        // If returned to stock, increment inventory levels and write history log
        if (item.disposition === 'RETURN_TO_STOCK') {
          const inv = product.stockLevels[0];
          if (inv) {
            const newQty = inv.quantity + item.quantity;
            await tx.stockLevel.update({
              where: { id: inv.id },
              data: { quantity: newQty }
            });

            await tx.inventoryHistory.create({
              data: {
                stockLevelId: inv.id,
                type: 'RETURN',
                quantityChanged: item.quantity,
                balanceQuantity: newQty,
                costPrice: inv.costPrice,
                referenceId: salesReturn.id,
                userId,
              }
            });
          }
        } else if (item.disposition === 'DAMAGED' || item.disposition === 'WARRANTY') {
          // Log inventory adjustment as damaged/warranty without changing sellable stock
          const inv = product.stockLevels[0];
          if (inv) {
            await tx.inventoryHistory.create({
              data: {
                stockLevelId: inv.id,
                type: 'RETURN_DAMAGED',
                quantityChanged: 0, // Sellable stock didn't change
                balanceQuantity: inv.quantity,
                costPrice: inv.costPrice,
                referenceId: salesReturn.id,
                userId,
              }
            });
          }
        }
      }

      const netRefund = subtotal + cgst + sgst;
      if (previouslyRefunded + netRefund > bill.netAmount + 0.01) {
        throw new BadRequestException('Total refund amount exceeds original invoice payment amount.');
      }

      // Update SalesReturn totals
      await tx.salesReturn.update({
        where: { id: salesReturn.id },
        data: {
          totalAmount: subtotal,
          cgstAmount: cgst,
          sgstAmount: sgst,
          netAmount: netRefund
        }
      });

      // Post Credit to Customer Account (reduces ledger outstanding)
      if (bill.customerId) {
        const lastLedger = await tx.customerLedger.findFirst({
          where: { customerId: bill.customerId },
          orderBy: { createdAt: 'desc' }
        });
        const currentBal = lastLedger ? lastLedger.runningBalance : 0.0;
        const newBal = currentBal - netRefund;

        await tx.customerLedger.create({
          data: {
            customerId: bill.customerId,
            salesReturnId: salesReturn.id,
            transactionType: 'RETURN',
            debit: 0.0,
            credit: netRefund,
            runningBalance: newBal,
          }
        });
      }

      // Log Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_SALES_RETURN',
          details: JSON.stringify({
            returnNumber,
            billNumber: bill.billNumber,
            netRefund
          })
        }
      });

      return { success: true, returnNumber };
    });
  }

  async createPurchaseReturn(data: any) {
    const { purchaseOrderId, reason, userId, items } = data;

    return await this.prisma.client.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { supplier: true, items: true }
      });
      if (!po) throw new NotFoundException('Purchase order not found');

      if (!items || items.length === 0) {
        throw new BadRequestException('No items provided for return');
      }

      // Query existing returns for this purchase order
      const existingReturns = await tx.purchaseReturn.findMany({
        where: { purchaseOrderId },
        include: { items: true }
      });

      // Map existing returned quantities by productId
      const returnedQtyMap = new Map<string, number>();
      existingReturns.forEach(ret => {
        ret.items.forEach(retItem => {
          const prev = returnedQtyMap.get(retItem.productId) || 0;
          returnedQtyMap.set(retItem.productId, prev + retItem.quantity);
        });
      });

      const previouslyRefunded = existingReturns.reduce((acc, r) => acc + r.netAmount, 0);

      const returnNumber = `PRET-${Date.now().toString().slice(-6)}`;

      let subtotal = 0;
      let cgst = 0;
      let sgst = 0;

      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          returnNumber,
          purchaseOrderId,
          totalAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          netAmount: 0,
          userId,
          reason,
        }
      });

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { stockLevels: true }
        });
        if (!product) throw new NotFoundException(`Product ${item.productId} not found`);

        if (item.quantity <= 0) {
          throw new BadRequestException(`Invalid return quantity: ${item.quantity}`);
        }

        const originalItem = po.items.find(pi => pi.productId === item.productId);
        if (!originalItem) {
          throw new BadRequestException(`Product ${item.productId} was not part of the original purchase order.`);
        }

        const alreadyReturned = returnedQtyMap.get(item.productId) || 0;
        if (alreadyReturned + item.quantity > originalItem.quantity) {
          throw new BadRequestException(
            `Cannot return quantity ${item.quantity}. Already returned: ${alreadyReturned}, Max allowed: ${originalItem.quantity}`
          );
        }

        // Deduct quantities from inventory levels since we are returning stock to supplier
        const inv = product.stockLevels[0];
        if (!inv || inv.quantity < item.quantity) {
          throw new BadRequestException(`Insufficient stock of ${product.name} to return to supplier. Available: ${inv?.quantity || 0}`);
        }

        const lineTotal = item.costPrice * item.quantity;
        const lineCgst = Number(((lineTotal * originalItem.cgstRate) / 100).toFixed(2));
        const lineSgst = Number(((lineTotal * originalItem.sgstRate) / 100).toFixed(2));
        const lineRefund = lineTotal + lineCgst + lineSgst;

        subtotal += lineTotal;
        cgst += lineCgst;
        sgst += lineSgst;

        await tx.purchaseReturnItem.create({
          data: {
            purchaseReturnId: purchaseReturn.id,
            productId: item.productId,
            quantity: item.quantity,
            costPrice: item.costPrice,
            refundAmount: lineRefund,
            notes: item.notes
          }
        });

        const newQty = inv.quantity - item.quantity;
        await tx.stockLevel.update({
          where: { id: inv.id },
          data: { quantity: newQty }
        });

        await tx.inventoryHistory.create({
          data: {
            stockLevelId: inv.id,
            type: 'ADJUSTMENT',
            quantityChanged: -item.quantity,
            balanceQuantity: newQty,
            costPrice: inv.costPrice,
            referenceId: purchaseReturn.id,
            userId,
          }
        });
      }

      const netRefund = subtotal + cgst + sgst;
      if (previouslyRefunded + netRefund > po.netAmount + 0.01) {
        throw new BadRequestException('Total refund amount exceeds original purchase order amount.');
      }

      await tx.purchaseReturn.update({
        where: { id: purchaseReturn.id },
        data: {
          totalAmount: subtotal,
          cgstAmount: cgst,
          sgstAmount: sgst,
          netAmount: netRefund
        }
      });

      // Post Debit to Supplier Ledger (reduces supplier outstanding credit balance)
      const lastLedger = await tx.supplierLedger.findFirst({
        where: { supplierId: po.supplierId },
        orderBy: { createdAt: 'desc' }
      });
      const currentBal = lastLedger ? lastLedger.runningBalance : 0.0;
      const newBal = currentBal - netRefund;

      await tx.supplierLedger.create({
        data: {
          supplierId: po.supplierId,
          purchaseReturnId: purchaseReturn.id,
          transactionType: 'RETURN',
          debit: netRefund,
          credit: 0.0,
          runningBalance: newBal,
        }
      });

      // Log Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_PURCHASE_RETURN',
          details: JSON.stringify({
            returnNumber,
            poNumber: po.poNumber,
            netRefund
          })
        }
      });

      return { success: true, returnNumber };
    });
  }

  async getReturns() {
    const salesReturns = await this.prisma.client.salesReturn.findMany({
      include: {
        bill: { select: { billNumber: true } },
        items: { include: { product: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const purchaseReturns = await this.prisma.client.purchaseReturn.findMany({
      include: {
        purchaseOrder: { select: { poNumber: true } },
        items: { include: { product: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return { salesReturns, purchaseReturns };
  }

  // ==========================================
  // Customer & Supplier Ledger Timelines
  // ==========================================

  async getCustomerLedger(customerId: string) {
    const ledger = await this.prisma.client.customerLedger.findMany({
      where: { customerId },
      include: {
        bill: { select: { billNumber: true, netAmount: true } },
        salesReturn: { select: { returnNumber: true, netAmount: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const customer = await this.prisma.client.customer.findUnique({
      where: { id: customerId }
    });

    return { customer, ledger };
  }

  async recordCustomerPayment(customerId: string, body: any) {
    const { amount, paymentMethod, notes, userId } = body;
    const paymentVal = Number(amount);

    return await this.prisma.client.$transaction(async (tx) => {
      const lastLedger = await tx.customerLedger.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' }
      });
      const currentBal = lastLedger ? lastLedger.runningBalance : 0.0;
      const newBal = currentBal - paymentVal;

      const ledgerEntry = await tx.customerLedger.create({
        data: {
          customerId,
          transactionType: 'PAYMENT',
          debit: 0.0,
          credit: paymentVal,
          runningBalance: newBal,
        }
      });

      await tx.customer.update({
        where: { id: customerId },
        data: { balance: newBal },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'RECORD_CUSTOMER_PAYMENT',
          details: JSON.stringify({
            customerId,
            amount: paymentVal,
            paymentMethod,
            notes
          })
        }
      });

      return ledgerEntry;
    });
  }

  async getSupplierLedger(supplierId: string) {
    const ledger = await this.prisma.client.supplierLedger.findMany({
      where: { supplierId },
      include: {
        purchaseOrder: { select: { poNumber: true, netAmount: true } },
        purchaseReturn: { select: { returnNumber: true, netAmount: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const supplier = await this.prisma.client.supplier.findUnique({
      where: { id: supplierId }
    });

    return { supplier, ledger };
  }

  async recordSupplierPayment(supplierId: string, body: any) {
    const { amount, notes, userId } = body;
    const paymentVal = Number(amount);

    return await this.prisma.client.$transaction(async (tx) => {
      const lastLedger = await tx.supplierLedger.findFirst({
        where: { supplierId },
        orderBy: { createdAt: 'desc' }
      });
      const currentBal = lastLedger ? lastLedger.runningBalance : 0.0;
      const newBal = currentBal - paymentVal;

      const ledgerEntry = await tx.supplierLedger.create({
        data: {
          supplierId,
          transactionType: 'PAYMENT',
          debit: paymentVal,
          credit: 0.0,
          runningBalance: newBal,
        }
      });

      await tx.supplier.update({
        where: { id: supplierId },
        data: { balance: newBal },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'RECORD_SUPPLIER_PAYMENT',
          details: JSON.stringify({
            supplierId,
            amount: paymentVal,
            notes
          })
        }
      });

      return ledgerEntry;
    });
  }
}
