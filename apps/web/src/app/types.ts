// Shared domain types for the ShopOS web app

export interface ProductPriceLevel {
  id: string;
  level: string; // 'RETAIL', 'WHOLESALE'
  price: number;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  rackLocation: string | null;
  minimumProfitPct: number;
  hsnCode: string | null;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  baseUnit: { name: string; abbreviation: string };
  priceLevels: ProductPriceLevel[];
  stockLevels: Array<{ quantity: number; costPrice: number; minStockLevel: number }>;
  mrp?: number | null;
  level1Price: number;
  level2Price: number;
  level3Price: number;
  emergencyPrice: number;
  categoryId?: string | null;
  baseUnitId?: string | null;
  isDeleted?: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
}

export interface Supplier {
  id: string;
  name: string;
  companyName?: string | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number; // discount per unit
  cgstRate: number;
  sgstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  totalPrice: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  priceLevel: string;
  creditLimit: number;
  balance: number;
  gstin?: string | null;
  address?: string | null;
}

export interface ActiveUser {
  userId: string;
  username: string;
  fullName: string;
  role: string;
}

// Every screen reachable from the sidebar. Add new tab ids here.
export type TabId =
  | 'pos'
  | 'inventory'
  | 'order-history'
  | 'knowledge-base'
  | 'settings'
  | 'approvals'
  | 'returns'
  | 'customer-ledgers'
  | 'supplier-ledgers';

// fetch() wrapper that adds the JWT and transparently refreshes it (see page.tsx)
export type SecureFetch = (url: string, options?: RequestInit) => Promise<Response>;

export interface CartTotals {
  subtotal: number;
  taxAmount: number;
  netAmount: number;
  cgst: number;
  sgst: number;
}

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'CREDIT';
