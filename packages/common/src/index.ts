import { z } from 'zod';

// ==========================================
// Authentication Schemas & Types
// ==========================================

export const LoginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const PinApprovalSchema = z.object({
  pin: z.string().length(4, 'PIN must be exactly 4 digits').regex(/^\d+$/, 'PIN must contain only digits'),
  module: z.string(),
  description: z.string(),
});

export type PinApprovalInput = z.infer<typeof PinApprovalSchema>;

// ==========================================
// POS Billing Schemas & Types
// ==========================================

export const BillItemSchema = z.object({
  productId: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  cgstRate: z.number().nonnegative(),
  sgstRate: z.number().nonnegative(),
  igstRate: z.number().nonnegative(),
});

export type BillItemInput = z.infer<typeof BillItemSchema>;

export const CreateBillSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  items: z.array(BillItemSchema).min(1, 'Cart must contain at least one item'),
  discountAmount: z.number().nonnegative().default(0),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'CREDIT']),
  paidAmount: z.number().nonnegative(),
  isQuote: z.boolean().default(false),
  paymentSplits: z.array(z.object({
    paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'CREDIT']),
    amount: z.number().positive(),
    transactionRef: z.string().optional().nullable(),
  })).optional(),
});

export type CreateBillInput = z.infer<typeof CreateBillSchema>;

// ==========================================
// Inventory adjustment schemas
// ==========================================

export const AdjustStockSchema = z.object({
  productId: z.string().uuid(),
  quantityChanged: z.number(), // positive to add, negative to remove
  type: z.enum(['ADJUSTMENT', 'RECONCILIATION', 'CYCLE_COUNT']),
  costPrice: z.number().positive().optional(),
  reason: z.string().min(3, 'Reason must be detailed'),
});

export type AdjustStockInput = z.infer<typeof AdjustStockSchema>;

// ==========================================
// GST Tax Calculator Utility
// ==========================================

export interface TaxCalculationResult {
  baseAmount: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  itemTotal: number;
}

export function calculateItemTaxes(
  quantity: number,
  unitPrice: number,
  discountPerItem: number,
  cgstRate: number,
  sgstRate: number,
  igstRate: number,
  isInterstate = false
): TaxCalculationResult {
  const baseAmount = quantity * unitPrice;
  const discountAmount = quantity * discountPerItem;
  const taxableAmount = Math.max(0, baseAmount - discountAmount);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterstate) {
    igstAmount = Number(((taxableAmount * igstRate) / 100).toFixed(2));
  } else {
    cgstAmount = Number(((taxableAmount * cgstRate) / 100).toFixed(2));
    sgstAmount = Number(((taxableAmount * sgstRate) / 100).toFixed(2));
  }

  const itemTotal = Number((taxableAmount + cgstAmount + sgstAmount + igstAmount).toFixed(2));

  return {
    baseAmount: Number(baseAmount.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    cgstAmount,
    sgstAmount,
    igstAmount,
    itemTotal,
  };
}
