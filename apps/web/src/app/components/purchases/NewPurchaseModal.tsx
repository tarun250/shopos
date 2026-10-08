'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { useShop } from '../../ShopContext';
import {
  DraftLineSeed,
  PAYMENT_METHODS,
  SupplierRecord,
  ErrorBox,
  apiError,
  inr,
  inputCls,
  labelCls,
  sectionTitleCls,
  todayIso,
  useEscapeLayer,
} from './shared';

export interface NewPurchaseSeed {
  supplierId: string | null;
  lines: DraftLineSeed[];
  // Shown above the form, e.g. when the reorder group has no supplier
  hint?: string;
}

interface NewPurchaseModalProps {
  seed: NewPurchaseSeed;
  onClose: () => void;
  // poNumber of the created order; received = goods were booked in too
  onCreated: (poNumber: string, received: boolean) => void;
}

interface DraftLine {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  cgstRate: number | null;
  sgstRate: number | null;
  quantity: string;
  unitCost: string;
}

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
const r2 = (n: number) => Math.round(n * 100) / 100;

// Rendered only while open (the parent mounts it with a fresh key), so state starts clean each time
export default function NewPurchaseModal({ seed, onClose, onCreated }: NewPurchaseModalProps) {
  const { API_BASE, secureFetch, fetchAllData } = useShop();

  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [supplierId, setSupplierId] = useState(seed.supplierId || '');
  const [lines, setLines] = useState<DraftLine[]>(() =>
    seed.lines.map(l => ({
      productId: l.productId,
      name: l.name,
      sku: l.sku,
      unit: l.unit,
      cgstRate: null,
      sgstRate: null,
      quantity: String(l.quantity),
      unitCost: l.unitCost != null && l.unitCost > 0 ? String(l.unitCost) : '',
    })),
  );
  const [expectedDate, setExpectedDate] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [alreadyReceived, setAlreadyReceived] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<string | null>(null); // set if create worked but receive failed

  // Product search
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  // Inline new-supplier form
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', companyName: '', gstin: '' });
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [savingSupplier, setSavingSupplier] = useState(false);

  useEscapeLayer(true, () => {
    if (search) {
      setSearch('');
      setResults([]);
    } else if (!submitting) onClose();
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await secureFetch(`${API_BASE}/suppliers`);
        if (res.ok) setSuppliers(await res.json());
        else setError(await apiError(res, 'Could not load suppliers'));
      } catch {
        setError('Network error loading suppliers.');
      }
    })();
    // Seeded lines (from reorder suggestions) need each product's GST rates for the live total
    seed.lines.forEach(async l => {
      try {
        const res = await secureFetch(`${API_BASE}/products/${l.productId}`);
        if (!res.ok) return;
        const p = await res.json();
        setLines(prev => prev.map(x => (x.productId === l.productId ? { ...x, cgstRate: p.cgstRate ?? 0, sgstRate: p.sgstRate ?? 0 } : x)));
      } catch {
        /* the total just shows without GST for this line */
      }
    });
  }, []);

  // Debounced product search
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await secureFetch(`${API_BASE}/products?search=${encodeURIComponent(q)}&take=20`);
        if (seq !== searchSeq.current) return;
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : data.items || []);
        } else setError(await apiError(res, 'Product search failed'));
      } catch {
        if (seq === searchSeq.current) setError('Network error searching products.');
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const addProduct = (p: any) => {
    setLines(prev => {
      const existing = prev.find(l => l.productId === p.id);
      if (existing) {
        return prev.map(l => (l.productId === p.id ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l));
      }
      const cost = p.stockLevels?.[0]?.costPrice;
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.baseUnit?.abbreviation || '',
          cgstRate: p.cgstRate ?? 0,
          sgstRate: p.sgstRate ?? 0,
          quantity: '1',
          unitCost: typeof cost === 'number' && cost > 0 ? String(cost) : '',
        },
      ];
    });
    setSearch('');
    setResults([]);
  };

  const updateLine = (productId: string, patch: Partial<DraftLine>) =>
    setLines(prev => prev.map(l => (l.productId === productId ? { ...l, ...patch } : l)));

  const totals = useMemo(() => {
    let taxable = 0, gst = 0, ratesMissing = false;
    for (const l of lines) {
      const base = r2((Number(l.quantity) || 0) * (Number(l.unitCost) || 0));
      taxable += base;
      if (l.cgstRate == null || l.sgstRate == null) ratesMissing = true;
      else gst += r2((base * l.cgstRate) / 100) + r2((base * l.sgstRate) / 100);
    }
    return { taxable: r2(taxable), gst: r2(gst), net: r2(taxable + gst), ratesMissing };
  }, [lines]);

  const selectedSupplier = suppliers.find(s => s.id === supplierId);

  const saveSupplier = async () => {
    setSupplierError(null);
    const body: Record<string, string> = { name: newSupplier.name.trim(), phone: newSupplier.phone.trim() };
    if (body.name.length < 2) return setSupplierError('Supplier name needs at least 2 characters.');
    if (!/^\d{10}$/.test(body.phone)) return setSupplierError('Phone must be exactly 10 digits.');
    const gstin = newSupplier.gstin.trim().toUpperCase();
    if (gstin && !GSTIN_RE.test(gstin)) return setSupplierError('GSTIN must be a valid 15-character GSTIN (e.g. 07AAACH0351E1ZB).');
    if (gstin) body.gstin = gstin;
    if (newSupplier.companyName.trim()) body.companyName = newSupplier.companyName.trim();
    setSavingSupplier(true);
    try {
      const res = await secureFetch(`${API_BASE}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return setSupplierError(await apiError(res, 'Could not add the supplier'));
      const s: SupplierRecord = await res.json();
      setSuppliers(prev => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)));
      setSupplierId(s.id);
      setShowNewSupplier(false);
      setNewSupplier({ name: '', phone: '', companyName: '', gstin: '' });
    } catch {
      setSupplierError('Network error adding the supplier.');
    } finally {
      setSavingSupplier(false);
    }
  };

  const validate = (): string | null => {
    if (!supplierId) return 'Pick a supplier.';
    if (lines.length === 0) return 'Add at least one product.';
    for (const l of lines) {
      const q = Number(l.quantity);
      if (l.quantity.trim() === '' || !Number.isFinite(q) || q <= 0) return `Enter a quantity greater than 0 for ${l.name}.`;
      const c = Number(l.unitCost);
      if (l.unitCost.trim() === '' || !Number.isFinite(c) || c < 0) return `Enter the unit cost for ${l.name}.`;
    }
    if (expectedDate && expectedDate < todayIso()) return 'Expected date cannot be in the past.';
    if (alreadyReceived && amountPaid.trim() !== '') {
      const paid = Number(amountPaid);
      if (!Number.isFinite(paid) || paid < 0) return 'Amount paid must be zero or more.';
      if (paid > totals.net + 0.01) return `Amount paid cannot exceed the order total of ${inr(totals.net)}.`;
    }
    return null;
  };

  const receiveAll = async (poId: string) => {
    const paid = amountPaid.trim() === '' ? 0 : Number(amountPaid);
    return secureFetch(`${API_BASE}/purchases/${poId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updateCostPrice: true,
        ...(invoiceNo.trim() ? { supplierInvoiceNumber: invoiceNo.trim() } : {}),
        ...(paid > 0 ? { amountPaid: paid, paymentMethod } : {}),
      }),
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (created) return onClose();
    const problem = validate();
    setError(problem);
    if (problem) return;
    setSubmitting(true);
    try {
      const res = await secureFetch(`${API_BASE}/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          items: lines.map(l => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })),
          ...(expectedDate ? { expectedDate } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(invoiceNo.trim() ? { supplierInvoiceNumber: invoiceNo.trim() } : {}),
        }),
      });
      if (!res.ok) {
        setError(await apiError(res, 'Could not create the purchase order'));
        return;
      }
      const po = await res.json();
      if (alreadyReceived) {
        const rec = await receiveAll(po.id);
        if (!rec.ok) {
          setCreated(po.poNumber);
          setError(`${po.poNumber} was created, but receiving the goods failed: ${await apiError(rec, 'receive failed')}. Open the order from the list to receive it.`);
          onCreated(po.poNumber, false);
          return;
        }
        fetchAllData().catch(() => {});
      }
      onCreated(po.poNumber, alreadyReceived);
      onClose();
    } catch {
      setError('Network error creating the purchase order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-60 flex items-center justify-center p-4" onClick={() => !submitting && (lines.length === 0 || created) && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        data-testid="new-po-modal"
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl"
      >
        <div className="flex justify-between items-start px-6 pt-5 pb-4 border-b border-neutral-800">
          <div>
            <h3 className="text-base font-bold text-white">New purchase order</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Unit costs are before GST; GST comes from each product&apos;s rates.</p>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white text-xl cursor-pointer" aria-label="Close">×</button>
        </div>

        <form onSubmit={submit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs">
            {seed.hint && <div className="bg-amber-950/30 border border-amber-900/40 text-amber-300 rounded-lg px-3 py-2">{seed.hint}</div>}

            {/* Supplier */}
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className={labelCls + ' mb-0'}>Supplier</label>
                <button
                  type="button"
                  onClick={() => { setShowNewSupplier(v => !v); setSupplierError(null); }}
                  className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 font-semibold cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />
                  {showNewSupplier ? 'Close' : 'New supplier'}
                </button>
              </div>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inputCls} data-testid="supplier-select">
                <option value="">Select a supplier…</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.companyName ? ` (${s.companyName})` : ''}
                  </option>
                ))}
              </select>
              {selectedSupplier && (
                <p className="text-[10px] text-neutral-500 mt-1 font-mono">
                  {selectedSupplier.phone}
                  {selectedSupplier.gstin && ` · GSTIN ${selectedSupplier.gstin}`}
                  {(selectedSupplier.balance ?? 0) > 0 && <span className="text-amber-400"> · We owe {inr(selectedSupplier.balance)}</span>}
                </p>
              )}
              {showNewSupplier && (
                <div className="mt-2 bg-neutral-950/60 border border-neutral-850 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Name *</label>
                      <input value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} className={inputCls} placeholder="Supplier name" />
                    </div>
                    <div>
                      <label className={labelCls}>Phone *</label>
                      <input value={newSupplier.phone} onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className={`${inputCls} font-mono`} placeholder="10 digits" inputMode="numeric" />
                    </div>
                    <div>
                      <label className={labelCls}>Company</label>
                      <input value={newSupplier.companyName} onChange={e => setNewSupplier({ ...newSupplier, companyName: e.target.value })} className={inputCls} placeholder="Optional" />
                    </div>
                    <div>
                      <label className={labelCls}>GSTIN</label>
                      <input value={newSupplier.gstin} onChange={e => setNewSupplier({ ...newSupplier, gstin: e.target.value.toUpperCase().slice(0, 15) })} className={`${inputCls} font-mono`} placeholder="Optional" />
                    </div>
                  </div>
                  <ErrorBox message={supplierError} />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={saveSupplier}
                      disabled={savingSupplier}
                      className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      {savingSupplier ? 'Saving…' : 'Add supplier'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Lines */}
            <div className="space-y-2">
              <h4 className={sectionTitleCls}>Items</h4>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (results[0]) addProduct(results[0]);
                    }
                  }}
                  placeholder="Search products by name, SKU or barcode to add"
                  className={`${inputCls} pl-9 py-2`}
                  data-testid="product-search"
                />
                {search.trim() && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl max-h-64 overflow-y-auto">
                    {searching && results.length === 0 ? (
                      <p className="p-3 text-neutral-500">Searching…</p>
                    ) : results.length === 0 ? (
                      <p className="p-3 text-neutral-500">No products found.</p>
                    ) : (
                      results.map(p => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => addProduct(p)}
                          className="w-full text-left px-3 py-2 hover:bg-neutral-900 flex justify-between gap-3 cursor-pointer border-b border-neutral-900 last:border-0"
                        >
                          <span>
                            <span className="text-white">{p.name}</span>
                            <span className="text-neutral-500 font-mono ml-2">{p.sku}</span>
                          </span>
                          <span className="text-neutral-500 font-mono whitespace-nowrap">
                            Stock {p.stockLevels?.[0]?.quantity ?? 0} {p.baseUnit?.abbreviation}
                            {typeof p.stockLevels?.[0]?.costPrice === 'number' && ` · cost ${inr(p.stockLevels[0].costPrice)}`}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {lines.length === 0 ? (
                <div className="border border-dashed border-neutral-800 rounded-lg p-6 text-center text-neutral-500">No items yet. Search above to add products.</div>
              ) : (
                <div className="border border-neutral-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-neutral-950/60 text-neutral-500 border-b border-neutral-800">
                        <th className="p-2 font-semibold">Product</th>
                        <th className="p-2 font-semibold w-24">Qty</th>
                        <th className="p-2 font-semibold w-28">Unit cost ₹</th>
                        <th className="p-2 font-semibold text-right w-28">Total incl. GST</th>
                        <th className="p-2 w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-850">
                      {lines.map(l => {
                        const base = (Number(l.quantity) || 0) * (Number(l.unitCost) || 0);
                        const gstPct = l.cgstRate == null || l.sgstRate == null ? null : l.cgstRate + l.sgstRate;
                        return (
                          <tr key={l.productId} data-testid="po-line">
                            <td className="p-2">
                              <div className="text-white">{l.name}</div>
                              <div className="text-[10px] text-neutral-500 font-mono">{l.sku} · GST {gstPct == null ? '…' : `${gstPct}%`}</div>
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <input type="number" min={0} step="any" value={l.quantity} onChange={e => updateLine(l.productId, { quantity: e.target.value })} className={`${inputCls} px-2 text-right font-mono`} />
                                <span className="text-[10px] text-neutral-500">{l.unit}</span>
                              </div>
                            </td>
                            <td className="p-2">
                              <input type="number" min={0} step="any" value={l.unitCost} placeholder="0.00" onChange={e => updateLine(l.productId, { unitCost: e.target.value })} className={`${inputCls} px-2 text-right font-mono`} />
                            </td>
                            <td className="p-2 text-right font-mono text-white">{inr(r2(base * (1 + (gstPct ?? 0) / 100)))}</td>
                            <td className="p-2 text-center">
                              <button type="button" onClick={() => setLines(prev => prev.filter(x => x.productId !== l.productId))} className="text-neutral-500 hover:text-red-400 cursor-pointer" aria-label={`Remove ${l.name}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Expected date</label>
                <input type="date" min={todayIso()} value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className={`${inputCls} scheme-dark`} />
              </div>
              <div>
                <label className={labelCls}>Supplier invoice no.</label>
                <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} maxLength={60} className={`${inputCls} font-mono`} placeholder="Optional" />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} className={inputCls} placeholder="Optional" />
              </div>
            </div>

            <div className="bg-neutral-950/60 border border-neutral-850 rounded-lg p-3 space-y-2">
              <label className="flex items-center gap-2 text-neutral-200 cursor-pointer select-none">
                <input type="checkbox" checked={alreadyReceived} onChange={e => setAlreadyReceived(e.target.checked)} className="accent-violet-600" data-testid="already-received" />
                Goods already received
                <span className="text-neutral-500">(adds everything to stock right away)</span>
              </label>
              {alreadyReceived && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div>
                    <label className={labelCls}>Amount paid now (₹)</label>
                    <input type="number" min={0} step="any" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className={`${inputCls} font-mono`} placeholder="0 = on credit" />
                  </div>
                  <div>
                    <label className={labelCls}>Method</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
                      {PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <ErrorBox message={error} onDismiss={() => setError(null)} />
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center gap-4 px-6 py-4 border-t border-neutral-800">
            <div className="text-xs space-y-0.5">
              <div className="text-neutral-400">
                Taxable <span className="font-mono text-neutral-200">{inr(totals.taxable)}</span> · GST <span className="font-mono text-neutral-200">{inr(totals.gst)}</span>
                {totals.ratesMissing && <span className="text-neutral-600"> (loading rates)</span>}
              </div>
              <div className="text-white font-bold">
                Total <span className="font-mono text-base" data-testid="po-total">{inr(totals.net)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs px-4 py-2 rounded-lg cursor-pointer">
                {created ? 'Close' : 'Cancel'}
              </button>
              {!created && (
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="create-po"
                  className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {submitting ? 'Saving…' : alreadyReceived ? 'Create & receive' : 'Create order'}
                </button>
              )}
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
