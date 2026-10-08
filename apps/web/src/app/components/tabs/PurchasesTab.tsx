'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ClipboardList, Plus, RefreshCw, Search } from 'lucide-react';
import TabPane from './TabPane';
import { useShop } from '../../ShopContext';
import { PurchaseListItem, StatusBadge, ErrorBox, apiError, inr, fmtDate } from '../purchases/shared';
import PurchaseDetailDrawer from '../purchases/PurchaseDetailDrawer';
import NewPurchaseModal, { NewPurchaseSeed } from '../purchases/NewPurchaseModal';
import ReorderPanel from '../purchases/ReorderPanel';

const PAGE_SIZE = 25;
// The API filters on one status at a time, so "Open" merges two queries of up to this many each
const OPEN_FETCH_LIMIT = 100;

type StatusFilter = 'all' | 'open' | 'RECEIVED' | 'CANCELLED';
const FILTERS: Array<[StatusFilter, string]> = [
  ['all', 'All'],
  ['open', 'Open'],
  ['RECEIVED', 'Received'],
  ['CANCELLED', 'Cancelled'],
];

export default function PurchasesTab() {
  const { API_BASE, secureFetch, isSandboxMode } = useShop();

  const [items, setItems] = useState<PurchaseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; poNumber: string } | null>(null);
  const [openCapped, setOpenCapped] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [poSeed, setPoSeed] = useState<NewPurchaseSeed | null>(null);
  const [poModalKey, setPoModalKey] = useState(0);
  const [showReorder, setShowReorder] = useState(false);
  const [reorderRefresh, setReorderRefresh] = useState(0);
  const requestSeq = useRef(0);

  const fetchPurchases = async () => {
    if (isSandboxMode) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const q = search.trim();
      const query = (st: string, pg: number, take: number) => {
        const params = new URLSearchParams({ page: String(pg), take: String(take) });
        if (st) params.set('status', st);
        if (q) params.set('search', q);
        return secureFetch(`${API_BASE}/purchases?${params.toString()}`);
      };

      let rows: PurchaseListItem[];
      let count: number;
      let capped = false;
      if (status === 'open') {
        const responses = await Promise.all([query('ORDERED', 1, OPEN_FETCH_LIMIT), query('PARTIALLY_RECEIVED', 1, OPEN_FETCH_LIMIT)]);
        const bad = responses.find(r => !r.ok);
        if (bad) throw new Error(await apiError(bad, 'Could not load purchase orders'));
        const [a, b] = await Promise.all(responses.map(r => r.json()));
        const merged: PurchaseListItem[] = [...a.items, ...b.items].sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt));
        capped = a.total > OPEN_FETCH_LIMIT || b.total > OPEN_FETCH_LIMIT;
        count = merged.length;
        rows = merged.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      } else {
        const res = await query(status === 'all' ? '' : status, page, PAGE_SIZE);
        if (!res.ok) throw new Error(await apiError(res, 'Could not load purchase orders'));
        const data = await res.json();
        rows = data.items;
        count = data.total;
      }
      if (seq !== requestSeq.current) return;
      setItems(rows);
      setTotal(count);
      setOpenCapped(capped);
      setError(null);
    } catch (err: any) {
      if (seq !== requestSeq.current) return;
      setError(err?.message && !String(err.message).includes('fetch') ? err.message : 'Network error loading purchase orders.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce typing in the search box
    const timer = setTimeout(fetchPurchases, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, status, page]);

  const openNewPo = (seed: NewPurchaseSeed) => {
    setPoModalKey(k => k + 1);
    setPoSeed(seed);
  };

  const handleCreated = (poNumber: string, received: boolean) => {
    setNotice({ text: received ? `${poNumber} created and goods received into stock.` : `${poNumber} created.`, poNumber });
    setReorderRefresh(k => k + 1);
    fetchPurchases();
  };

  const filtersActive = status !== 'all' || search.trim() !== '';

  return (
    <TabPane className="flex-1 flex flex-col p-6 overflow-hidden h-full space-y-5">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Purchases</h2>
          <p className="text-xs text-neutral-400 mt-1">Order stock from suppliers, receive deliveries and track what you owe.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPurchases}
            title="Refresh"
            className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowReorder(true)}
            className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Reorder suggestions
          </button>
          <button
            onClick={() => openNewPo({ supplierId: null, lines: [] })}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New purchase order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-55">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search PO number, supplier invoice no. or supplier name"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-neutral-950 border border-neutral-850 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => { setStatus(value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                status === value ? 'bg-white text-neutral-950' : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="bg-green-950/40 border border-green-900/50 text-green-300 text-xs rounded-lg px-3 py-2 flex justify-between gap-3">
          <span>
            {notice.text}{' '}
            <button onClick={() => setSelectedId(notice.poNumber)} className="underline hover:text-white cursor-pointer">Open it</button>
          </span>
          <button onClick={() => setNotice(null)} className="text-green-400 hover:text-white cursor-pointer" aria-label="Dismiss">×</button>
        </div>
      )}
      <ErrorBox message={error} onDismiss={() => setError(null)} />

      {/* Purchase orders table */}
      <div className="flex-1 overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-xl">
        {!loading && items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm text-neutral-500">
              {isSandboxMode
                ? 'Purchases need the backend; they are not available in sandbox mode.'
                : filtersActive
                  ? 'No purchase orders match these filters.'
                  : 'No purchase orders yet.'}
            </p>
            {!isSandboxMode && !filtersActive && (
              <button
                onClick={() => setShowReorder(true)}
                className="text-xs text-violet-400 hover:text-violet-300 font-semibold cursor-pointer"
              >
                See what needs reordering →
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-neutral-900 z-10">
              <tr className="border-b border-neutral-800 text-neutral-500">
                <th className="p-3 font-semibold">PO</th>
                <th className="p-3 font-semibold">Date</th>
                <th className="p-3 font-semibold">Supplier</th>
                <th className="p-3 font-semibold text-center">Items</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Total</th>
                <th className="p-3 font-semibold text-right">Unpaid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-850 text-neutral-300">
              {items.map(po => (
                <tr
                  key={po.id}
                  onClick={() => setSelectedId(po.id)}
                  data-testid="po-row"
                  className="hover:bg-neutral-850/30 transition-colors cursor-pointer"
                >
                  <td className="p-3 font-mono font-medium text-white">
                    {po.poNumber}
                    {po.supplierInvoiceNumber && (
                      <div className="text-[10px] text-neutral-500 font-normal">Inv {po.supplierInvoiceNumber}</div>
                    )}
                  </td>
                  <td className="p-3 text-neutral-400 whitespace-nowrap">
                    {fmtDate(po.createdAt)}
                    {po.expectedDate && po.status === 'ORDERED' && (
                      <div className="text-[10px] text-neutral-500">Expected {fmtDate(po.expectedDate)}</div>
                    )}
                  </td>
                  <td className="p-3 text-white">{po.supplier?.name}</td>
                  <td className="p-3 text-center font-mono">{po._count?.items ?? 0}</td>
                  <td className="p-3"><StatusBadge status={po.status} /></td>
                  <td className="p-3 text-right font-mono font-bold text-white whitespace-nowrap">{inr(po.netAmount)}</td>
                  <td className="p-3 text-right font-mono whitespace-nowrap">
                    {po.status === 'CANCELLED' ? (
                      <span className="text-neutral-600">—</span>
                    ) : po.status === 'ORDERED' ? (
                      <span className="text-neutral-500" title="Nothing is owed until goods are received">Not due</span>
                    ) : po.balanceAmount > 0 ? (
                      <span className="text-amber-400">{inr(po.balanceAmount)}</span>
                    ) : (
                      <span className="text-green-400">Paid</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination (right padding keeps it clear of the floating copilot button) */}
      <div className="flex justify-between items-center text-xs text-neutral-500 pr-16">
        <span>
          {total === 0
            ? 'No purchase orders'
            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
          {openCapped && ' (newest open orders only)'}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            disabled={page * PAGE_SIZE >= total}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      <PurchaseDetailDrawer purchaseId={selectedId} onClose={() => setSelectedId(null)} onChanged={() => { fetchPurchases(); setReorderRefresh(k => k + 1); }} />

      <ReorderPanel
        open={showReorder}
        onClose={() => setShowReorder(false)}
        onCreatePo={openNewPo}
        refreshKey={reorderRefresh}
        covered={poSeed !== null}
      />

      <AnimatePresence>
        {poSeed && (
          <NewPurchaseModal key={poModalKey} seed={poSeed} onClose={() => setPoSeed(null)} onCreated={handleCreated} />
        )}
      </AnimatePresence>
    </TabPane>
  );
}
