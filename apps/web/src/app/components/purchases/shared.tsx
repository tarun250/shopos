'use client';

import React, { useEffect, useRef } from 'react';

// Shared types and helpers for the Purchases screen.

export type PurchaseStatus = 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseListItem {
  id: string;
  poNumber: string;
  status: PurchaseStatus;
  netAmount: number;
  paidAmount: number;
  balanceAmount: number;
  createdAt: string;
  expectedDate: string | null;
  supplierInvoiceNumber: string | null;
  supplier: { id: string; name: string };
  _count: { items: number };
}

export interface PurchaseLine {
  id: string;
  productId: string;
  quantity: number;
  receivedQuantity: number;
  costPrice?: number; // stripped by the API for MANAGER
  cgstRate: number;
  sgstRate: number;
  totalPrice: number;
  product: { id: string; name: string; sku: string; baseUnit: { abbreviation: string } | null } | null;
}

export interface SupplierLedgerEntry {
  id: string;
  transactionType: string;
  debit: number;
  credit: number;
  runningBalance: number;
  createdAt: string;
}

export interface PurchaseDetail extends Omit<PurchaseListItem, '_count' | 'supplier'> {
  totalAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  receivedAt: string | null;
  notes: string | null;
  supplier: SupplierRecord;
  items: PurchaseLine[];
  supplierLedger: SupplierLedgerEntry[];
}

export interface SupplierRecord {
  id: string;
  name: string;
  companyName?: string | null;
  phone?: string;
  gstin?: string | null;
  balance?: number;
}

export interface ReorderItem {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  stock: number;
  minStock: number;
  soldLast30Days: number;
  averageDailySales: number;
  daysOfCover: number | null;
  onOrder: number;
  suggestedQuantity: number;
  lastCost: number;
  urgent: boolean;
}

export interface ReorderGroup {
  supplier: { id: string; name: string } | null;
  estimatedCost: number;
  items: ReorderItem[];
}

// Line handed to the New purchase order modal (from the reorder panel)
export interface DraftLineSeed {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  unitCost: number | null;
}

export const PAYMENT_METHODS = [
  ['CASH', 'Cash'],
  ['UPI', 'UPI'],
  ['BANK_TRANSFER', 'Bank transfer'],
  ['CHEQUE', 'Cheque'],
] as const;

export const inr = (n: number | null | undefined) =>
  `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtQty = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 3 });

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Turns a failed response into a readable message (class-validator sends message: string[])
export async function apiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    const msg = Array.isArray(body?.message) ? body.message.join('; ') : body?.message;
    return msg ? String(msg) : `${fallback} (HTTP ${res.status})`;
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}

const STATUS_STYLE: Record<PurchaseStatus, { label: string; cls: string }> = {
  ORDERED: { label: 'Ordered', cls: 'bg-blue-950 text-blue-400 border-blue-900/40' },
  PARTIALLY_RECEIVED: { label: 'Part received', cls: 'bg-amber-950 text-amber-400 border-amber-900/40' },
  RECEIVED: { label: 'Received', cls: 'bg-green-950 text-green-400 border-green-900/40' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-neutral-800 text-neutral-400 border-neutral-700' },
};

export function StatusBadge({ status }: { status: PurchaseStatus }) {
  const s = STATUS_STYLE[status] || { label: status, cls: 'bg-neutral-800 text-neutral-400 border-neutral-700' };
  return (
    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function ErrorBox({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="bg-red-950/40 border border-red-900/50 text-red-300 text-xs rounded-lg px-3 py-2 flex justify-between gap-3">
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-white cursor-pointer" aria-label="Dismiss">×</button>
      )}
    </div>
  );
}

export const inputCls =
  'w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600';
export const labelCls = 'block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1';
export const sectionTitleCls = 'text-[10px] text-neutral-500 uppercase tracking-wider font-bold';

// Escape closes only the top-most open layer (drawer, panel or modal)
const escapeStack: Array<{ current: () => void }> = [];
let escapeListening = false;
function onEscapeKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || escapeStack.length === 0) return;
  escapeStack[escapeStack.length - 1].current();
}

export function useEscapeLayer(active: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const entry = { current: () => ref.current() };
    escapeStack.push(entry);
    if (!escapeListening) {
      window.addEventListener('keydown', onEscapeKey);
      escapeListening = true;
    }
    return () => {
      const i = escapeStack.indexOf(entry);
      if (i >= 0) escapeStack.splice(i, 1);
      if (escapeStack.length === 0 && escapeListening) {
        window.removeEventListener('keydown', onEscapeKey);
        escapeListening = false;
      }
    };
  }, [active]);
}
