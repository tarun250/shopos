'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, ShoppingCart } from 'lucide-react';
import { useShop } from '../../ShopContext';
import { ReorderGroup, ErrorBox, apiError, inr, fmtQty, inputCls, labelCls, useEscapeLayer } from './shared';
import type { NewPurchaseSeed } from './NewPurchaseModal';

interface ReorderPanelProps {
  open: boolean;
  onClose: () => void;
  onCreatePo: (seed: NewPurchaseSeed) => void;
  // Bumped by the parent after a PO is created so "on order" figures refresh
  refreshKey: number;
  // True while the PO modal is open on top (it owns Escape then)
  covered: boolean;
}

// Slide-over with reorder suggestions grouped by supplier; each group can become a purchase order
export default function ReorderPanel({ open, onClose, onCreatePo, refreshKey, covered }: ReorderPanelProps) {
  const { API_BASE, secureFetch } = useShop();

  const [groups, setGroups] = useState<ReorderGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadDays, setLeadDays] = useState('7');
  const [coverDays, setCoverDays] = useState('14');
  const [qty, setQty] = useState<Record<string, string>>({});

  useEscapeLayer(open && !covered, onClose);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ leadDays: String(Number(leadDays) || 7), coverDays: String(Number(coverDays) || 14) });
      const res = await secureFetch(`${API_BASE}/reports/reorder?${params.toString()}`);
      if (!res.ok) {
        setError(await apiError(res, 'Could not load reorder suggestions'));
        return;
      }
      const data = await res.json();
      const list: ReorderGroup[] = data.bySupplier || [];
      // Groups without a supplier go last
      list.sort((a, b) => Number(!a.supplier) - Number(!b.supplier));
      setGroups(list);
      const q: Record<string, string> = {};
      for (const g of list) for (const i of g.items) q[i.productId] = String(i.suggestedQuantity);
      setQty(q);
    } catch {
      setError('Network error loading reorder suggestions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open, refreshKey]);

  const qtyOf = (productId: string) => {
    const n = Number(qty[productId]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const createFromGroup = (g: ReorderGroup) => {
    const lines = g.items
      .filter(i => qtyOf(i.productId) > 0)
      .map(i => ({ productId: i.productId, name: i.name, sku: i.sku, unit: i.unit, quantity: qtyOf(i.productId), unitCost: i.lastCost || null }));
    if (lines.length === 0) {
      setError('Every quantity in that group is 0; set at least one to order.');
      return;
    }
    setError(null);
    onCreatePo({
      supplierId: g.supplier?.id || null,
      lines,
      hint: g.supplier ? undefined : 'These products have no supplier linked. Pick (or add) the supplier for this order.',
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end" onClick={onClose}>
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.2 }}
            onClick={e => e.stopPropagation()}
            data-testid="reorder-panel"
            className="bg-neutral-900 border-l border-neutral-800 w-full max-w-3xl h-full flex flex-col shadow-2xl"
          >
            <div className="flex justify-between items-start p-6 border-b border-neutral-800">
              <div>
                <h3 className="text-base font-bold text-white">Reorder suggestions</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Based on the last 30 days of sales, minimum stock and what is already on order.
                </p>
              </div>
              <button onClick={onClose} className="text-neutral-400 hover:text-white text-xl cursor-pointer" aria-label="Close">×</button>
            </div>

            <div className="flex items-end gap-3 px-6 py-3 border-b border-neutral-800 text-xs">
              <div className="w-32">
                <label className={labelCls}>Lead time (days)</label>
                <input type="number" min={1} max={90} value={leadDays} onChange={e => setLeadDays(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div className="w-32">
                <label className={labelCls}>Cover (days)</label>
                <input type="number" min={1} max={90} value={coverDays} onChange={e => setCoverDays(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <button
                onClick={load}
                className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Recalculate
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <ErrorBox message={error} onDismiss={() => setError(null)} />
              {loading && groups.length === 0 ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-24 bg-neutral-800/60 rounded-xl" />
                  <div className="h-24 bg-neutral-800/60 rounded-xl" />
                </div>
              ) : groups.length === 0 && !error ? (
                <div className="p-12 text-center text-sm text-neutral-500">Nothing needs reordering right now.</div>
              ) : (
                groups.map(g => {
                  const est = g.items.reduce((s, i) => s + qtyOf(i.productId) * (i.lastCost || 0), 0);
                  const urgentCount = g.items.filter(i => i.urgent).length;
                  return (
                    <div key={g.supplier?.id || 'none'} data-testid="reorder-group" className={`bg-neutral-950/60 border rounded-xl ${g.supplier ? 'border-neutral-800' : 'border-amber-900/50'}`}>
                      <div className="flex justify-between items-center gap-3 px-4 py-3 border-b border-neutral-850">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{g.supplier?.name || 'No supplier linked'}</p>
                          <p className="text-[10px] text-neutral-500">
                            {g.items.length} product{g.items.length === 1 ? '' : 's'}
                            {urgentCount > 0 && <span className="text-red-400"> · {urgentCount} at or below minimum</span>}
                            {' · '}est. {inr(Math.round(est * 100) / 100)} before GST
                          </p>
                          {!g.supplier && <p className="text-[10px] text-amber-400 mt-0.5">You will pick the supplier in the purchase order.</p>}
                        </div>
                        <button
                          onClick={() => createFromGroup(g)}
                          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shrink-0"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          Create PO
                        </button>
                      </div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-neutral-500">
                            <th className="px-4 py-2 font-semibold">Product</th>
                            <th className="px-2 py-2 font-semibold text-right whitespace-nowrap">Stock / min</th>
                            <th className="px-2 py-2 font-semibold text-right whitespace-nowrap">Sold 30d</th>
                            <th className="px-2 py-2 font-semibold text-right whitespace-nowrap">Cover</th>
                            <th className="px-2 py-2 font-semibold text-right whitespace-nowrap">On order</th>
                            <th className="px-2 py-2 font-semibold text-right whitespace-nowrap">Last cost</th>
                            <th className="px-4 py-2 font-semibold text-right w-28 whitespace-nowrap">Order qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-850 text-neutral-300">
                          {g.items.map(i => (
                            <tr key={i.productId} className={i.urgent ? 'bg-red-950/20' : ''}>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-1.5 text-white">
                                  {i.urgent && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" aria-label="Urgent" />}
                                  <span>{i.name}</span>
                                </div>
                                <div className="text-[10px] text-neutral-500 font-mono">{i.sku}</div>
                              </td>
                              <td className={`px-2 py-2 text-right font-mono whitespace-nowrap ${i.urgent ? 'text-red-400 font-semibold' : ''}`}>
                                {fmtQty(i.stock)} / {fmtQty(i.minStock)}
                              </td>
                              <td className="px-2 py-2 text-right font-mono">{fmtQty(i.soldLast30Days)}</td>
                              <td className="px-2 py-2 text-right font-mono whitespace-nowrap">{i.daysOfCover == null ? '—' : `${Math.round(i.daysOfCover)}d`}</td>
                              <td className="px-2 py-2 text-right font-mono">{i.onOrder > 0 ? fmtQty(i.onOrder) : '—'}</td>
                              <td className="px-2 py-2 text-right font-mono whitespace-nowrap">{i.lastCost ? inr(i.lastCost) : '—'}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-1 justify-end">
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={qty[i.productId] ?? ''}
                                    onChange={e => setQty(prev => ({ ...prev, [i.productId]: e.target.value }))}
                                    className={`${inputCls} w-20 px-2 text-right font-mono`}
                                  />
                                  <span className="text-[10px] text-neutral-500 w-6">{i.unit}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
