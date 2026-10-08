'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PackageCheck, XCircle } from 'lucide-react';
import { useShop } from '../../ShopContext';
import {
  PurchaseDetail,
  PAYMENT_METHODS,
  StatusBadge,
  ErrorBox,
  apiError,
  inr,
  fmtQty,
  fmtDate,
  inputCls,
  labelCls,
  sectionTitleCls,
  useEscapeLayer,
} from './shared';

interface PurchaseDetailDrawerProps {
  purchaseId: string | null;
  onClose: () => void;
  // Called after the order changed (received or cancelled) so the list can refresh
  onChanged: () => void;
}

const LEDGER_LABELS: Record<string, string> = { PURCHASE: 'Goods received', PAYMENT: 'Payment', RETURN: 'Return' };

// Slide-over with one purchase order: lines, totals, supplier ledger, receiving and cancelling
export default function PurchaseDetailDrawer({ purchaseId, onClose, onChanged }: PurchaseDetailDrawerProps) {
  const { API_BASE, secureFetch, fetchAllData } = useShop();

  const [po, setPo] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Receive form
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [updateCost, setUpdateCost] = useState(true);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [busy, setBusy] = useState<'receive' | 'cancel' | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEscapeLayer(!!purchaseId, () => {
    if (confirmCancel) setConfirmCancel(false);
    else onClose();
  });

  const resetForm = (data: PurchaseDetail) => {
    const qty: Record<string, string> = {};
    for (const line of data.items) qty[line.id] = String(Math.max(0, line.quantity - line.receivedQuantity));
    setReceiveQty(qty);
    setUpdateCost(true);
    setInvoiceNo(data.supplierInvoiceNumber || '');
    setAmountPaid('');
    setPaymentMethod('CASH');
    setConfirmCancel(false);
  };

  const load = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await secureFetch(`${API_BASE}/purchases/${encodeURIComponent(id)}`);
      if (!res.ok) {
        setError(await apiError(res, 'Could not load this purchase order'));
        setPo(null);
        return;
      }
      const data: PurchaseDetail = await res.json();
      setPo(data);
      resetForm(data);
    } catch {
      setError('Network error loading the purchase order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setNotice(null);
    if (purchaseId) load(purchaseId);
    else setPo(null);
  }, [purchaseId]);

  const isOpen = po && (po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED');
  const nothingReceived = po ? po.items.every(i => i.receivedQuantity <= 0) : false;

  const receiveLines = po
    ? po.items.map(line => {
        const outstanding = Math.max(0, line.quantity - line.receivedQuantity);
        const raw = receiveQty[line.id] ?? '';
        const qty = raw.trim() === '' ? 0 : Number(raw);
        return { line, outstanding, qty };
      })
    : [];
  const receiveValue = receiveLines.reduce(
    (sum, { line, qty }) => sum + (Number.isFinite(qty) && qty > 0 ? qty * (line.costPrice ?? 0) * (1 + (line.cgstRate + line.sgstRate) / 100) : 0),
    0,
  );

  const handleReceive = async () => {
    if (!po) return;
    setError(null);
    setNotice(null);
    for (const { line, outstanding, qty } of receiveLines) {
      const name = line.product?.name || 'an item';
      if (!Number.isFinite(qty) || qty < 0) return setError(`Enter a valid quantity for ${name}.`);
      if (qty > outstanding + 1e-9) return setError(`Only ${fmtQty(outstanding)} of ${name} is still outstanding.`);
    }
    const items = receiveLines.filter(r => r.qty > 0).map(r => ({ productId: r.line.productId, quantity: r.qty }));
    if (items.length === 0) return setError('Enter a quantity for at least one line.');
    const paid = amountPaid.trim() === '' ? 0 : Number(amountPaid);
    if (!Number.isFinite(paid) || paid < 0) return setError('Amount paid must be zero or more.');
    if (paid > po.balanceAmount + 1e-9) return setError(`Amount paid cannot exceed the unpaid balance of ${inr(po.balanceAmount)}.`);

    setBusy('receive');
    try {
      const res = await secureFetch(`${API_BASE}/purchases/${po.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          updateCostPrice: updateCost,
          ...(invoiceNo.trim() ? { supplierInvoiceNumber: invoiceNo.trim() } : {}),
          ...(paid > 0 ? { amountPaid: paid, paymentMethod } : {}),
        }),
      });
      if (!res.ok) {
        setError(await apiError(res, 'Could not receive the goods'));
        return;
      }
      setNotice('Goods received and stock updated.');
      await load(po.id);
      onChanged();
      fetchAllData().catch(() => {});
    } catch {
      setError('Network error while receiving goods.');
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    if (!po) return;
    setError(null);
    setBusy('cancel');
    try {
      const res = await secureFetch(`${API_BASE}/purchases/${po.id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        setError(await apiError(res, 'Could not cancel the order'));
        return;
      }
      setNotice('Order cancelled.');
      await load(po.id);
      onChanged();
    } catch {
      setError('Network error while cancelling.');
    } finally {
      setBusy(null);
      setConfirmCancel(false);
    }
  };

  return (
    <AnimatePresence>
      {purchaseId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end" onClick={onClose}>
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.2 }}
            onClick={e => e.stopPropagation()}
            data-testid="purchase-drawer"
            className="bg-neutral-900 border-l border-neutral-800 w-full max-w-xl h-full flex flex-col shadow-2xl"
          >
            {!po ? (
              <div className="p-6 space-y-3">
                {loading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-5 bg-neutral-800 rounded w-1/2" />
                    <div className="h-3 bg-neutral-800 rounded w-3/4" />
                    <div className="h-3 bg-neutral-800 rounded w-2/3" />
                  </div>
                ) : (
                  <>
                    <div className="flex justify-end">
                      <button onClick={onClose} className="text-neutral-400 hover:text-white text-xl cursor-pointer">×</button>
                    </div>
                    <ErrorBox message={error || 'Purchase order not found.'} />
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-neutral-800">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white font-mono">{po.poNumber}</h3>
                      <StatusBadge status={po.status} />
                    </div>
                    <p className="text-sm text-white font-semibold mt-1 truncate">{po.supplier?.name}</p>
                    {(po.supplier?.companyName || po.supplier?.gstin) && (
                      <p className="text-[10px] text-neutral-500 font-mono">
                        {po.supplier.companyName}
                        {po.supplier.companyName && po.supplier.gstin && ' · '}
                        {po.supplier.gstin && `GSTIN ${po.supplier.gstin}`}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 mt-2">
                      Ordered {fmtDate(po.createdAt)}
                      {po.expectedDate && ` · Expected ${fmtDate(po.expectedDate)}`}
                      {po.receivedAt && ` · Received ${fmtDate(po.receivedAt)}`}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Supplier invoice: <span className="text-neutral-300 font-mono">{po.supplierInvoiceNumber || '—'}</span>
                    </p>
                  </div>
                  <button onClick={onClose} className="text-neutral-400 hover:text-white text-xl cursor-pointer" aria-label="Close">×</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pb-20 space-y-5 text-xs">
                  <ErrorBox message={error} onDismiss={() => setError(null)} />
                  {notice && (
                    <div className="bg-green-950/40 border border-green-900/50 text-green-300 rounded-lg px-3 py-2">{notice}</div>
                  )}

                  {po.notes && (
                    <div className="bg-neutral-950/60 border border-neutral-850 rounded-lg p-3">
                      <span className={sectionTitleCls}>Notes</span>
                      <p className="text-neutral-300 mt-1 whitespace-pre-wrap">{po.notes}</p>
                    </div>
                  )}

                  {/* Lines */}
                  <div className="space-y-2">
                    <h4 className={sectionTitleCls}>Items</h4>
                    {po.items.map(line => {
                      const unit = line.product?.baseUnit?.abbreviation || '';
                      const outstanding = Math.max(0, line.quantity - line.receivedQuantity);
                      return (
                        <div key={line.id} className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-850 flex justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-white">{line.product?.name || 'Product'}</p>
                            <p className="text-[10px] text-neutral-500 font-mono">
                              {line.product?.sku} · {fmtQty(line.quantity)} {unit}{typeof line.costPrice === 'number' && ` × ${inr(line.costPrice)}`} · GST {line.cgstRate + line.sgstRate}%
                            </p>
                            <p className="text-[10px] mt-1 font-semibold">
                              <span className="text-neutral-400">Ordered {fmtQty(line.quantity)}</span>
                              <span className="text-green-400"> · Received {fmtQty(line.receivedQuantity)}</span>
                              {po.status !== 'CANCELLED' && outstanding > 0 && (
                                <span className="text-amber-400"> · Outstanding {fmtQty(outstanding)}</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right font-mono font-semibold text-white whitespace-nowrap">{inr(line.totalPrice)}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Totals */}
                  <div className="border-t border-neutral-800 pt-4 space-y-1.5">
                    {([
                      ['Taxable value', po.totalAmount],
                      ['CGST', po.cgstAmount],
                      ['SGST', po.sgstAmount],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="flex justify-between text-neutral-400">
                        <span>{label}</span>
                        <span className="font-mono">{inr(value)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-white font-bold pt-1.5 border-t border-neutral-850">
                      <span>Order total</span>
                      <span className="font-mono">{inr(po.netAmount)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Paid</span>
                      <span className="font-mono">{inr(po.paidAmount)}</span>
                    </div>
                    {po.status !== 'CANCELLED' && po.balanceAmount > 0 && (
                      <div className="flex justify-between text-amber-400 font-semibold">
                        <span>Unpaid</span>
                        <span className="font-mono">{inr(po.balanceAmount)}</span>
                      </div>
                    )}
                  </div>

                  {/* Supplier ledger for this order */}
                  <div className="space-y-2">
                    <h4 className={sectionTitleCls}>Supplier ledger</h4>
                    {po.supplierLedger?.length ? (
                      <div className="bg-neutral-950/60 border border-neutral-850 rounded-lg divide-y divide-neutral-850">
                        {po.supplierLedger.map(entry => (
                          <div key={entry.id} className="flex justify-between gap-3 px-3 py-2">
                            <div>
                              <p className="text-neutral-200">{LEDGER_LABELS[entry.transactionType] || entry.transactionType}</p>
                              <p className="text-[10px] text-neutral-500">{new Date(entry.createdAt).toLocaleString('en-IN')}</p>
                            </div>
                            <div className="text-right font-mono">
                              {entry.credit > 0 && <p className="text-amber-400">+{inr(entry.credit)} owed</p>}
                              {entry.debit > 0 && <p className="text-green-400">−{inr(entry.debit)} paid</p>}
                              <p className="text-[10px] text-neutral-500">Balance {inr(entry.runningBalance)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-neutral-500">No ledger entries yet. The supplier is owed only once goods are received.</p>
                    )}
                  </div>

                  {/* Receive */}
                  {isOpen && (
                    <div className="bg-neutral-950/60 border border-violet-900/40 rounded-xl p-4 space-y-3" data-testid="receive-section">
                      <div className="flex items-center gap-2">
                        <PackageCheck className="w-4 h-4 text-violet-400" />
                        <h4 className="text-xs font-bold text-white">Receive goods</h4>
                      </div>
                      <p className="text-[11px] text-neutral-500">Quantities start at what is outstanding. Set a line to 0 to skip it.</p>
                      <div className="space-y-1.5">
                        {receiveLines.map(({ line, outstanding }) =>
                          outstanding <= 0 ? null : (
                            <div key={line.id} className="flex items-center justify-between gap-3">
                              <span className="text-neutral-300 truncate">{line.product?.name}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <input
                                  type="number"
                                  min={0}
                                  max={outstanding}
                                  step="any"
                                  value={receiveQty[line.id] ?? ''}
                                  onChange={e => setReceiveQty(prev => ({ ...prev, [line.id]: e.target.value }))}
                                  className={`${inputCls} w-20 text-right font-mono`}
                                />
                                <span className="text-[10px] text-neutral-500 w-16">of {fmtQty(outstanding)} {line.product?.baseUnit?.abbreviation}</span>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                      <label className="flex items-center gap-2 text-neutral-300 cursor-pointer select-none">
                        <input type="checkbox" checked={updateCost} onChange={e => setUpdateCost(e.target.checked)} className="accent-violet-600" />
                        Update cost price (weighted average with current stock)
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className={labelCls}>Supplier invoice no.</label>
                          <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} maxLength={60} className={`${inputCls} font-mono`} placeholder="Optional" />
                        </div>
                        <div>
                          <label className={labelCls}>Amount paid (₹)</label>
                          <input type="number" min={0} step="any" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className={`${inputCls} font-mono`} placeholder="0" />
                        </div>
                        <div>
                          <label className={labelCls}>Method</label>
                          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} disabled={!Number(amountPaid)} className={`${inputCls} disabled:opacity-50`}>
                            {PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-neutral-400">
                          {po.items.every(i => typeof i.costPrice === 'number') && (
                            <>
                              Value received <span className="font-mono text-white">{inr(Math.round(receiveValue * 100) / 100)}</span> <span className="text-neutral-600">incl. GST</span>
                            </>
                          )}
                        </span>
                        <button
                          onClick={handleReceive}
                          disabled={busy !== null}
                          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          {busy === 'receive' ? 'Receiving…' : 'Receive'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {isOpen && nothingReceived && (
                  <div className="p-4 pr-20 border-t border-neutral-800">{/* right padding keeps it clear of the floating copilot button */}
                    {confirmCancel ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-red-300">Cancel {po.poNumber}? This cannot be undone.</span>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmCancel(false)} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs px-3 py-1.5 rounded-lg cursor-pointer">
                            Keep order
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={busy !== null}
                            data-testid="confirm-cancel"
                            className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                          >
                            {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel order'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmCancel(true)}
                        className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-red-950 hover:text-red-300 text-neutral-300 text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel order
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
