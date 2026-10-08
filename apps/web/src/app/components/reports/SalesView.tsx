'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useShop } from '../../ShopContext';
import TrendChart, { DailyPoint } from './TrendChart';
import { CategoryBars, CategoryRow, PaymentMix, PaymentRow } from './Breakdowns';
import { Card, Column, DataTable, PillGroup, SERIES, Skeleton, StatTile } from './ui';
import { inr, longDate, num, pct, PeriodPreset, presetRange, ymd } from './format';

interface Summary {
  range: { from: string; to: string };
  kpis: {
    revenue: number;
    revenueBeforeGst: number;
    bills: number;
    averageBill: number;
    gstCollected: number;
    creditOutstandingFromPeriod: number;
    expenses: number;
    returns: { count: number; amount: number };
    profit?: number;
    netProfit?: number;
  };
  daily: DailyPoint[];
  paymentMix: PaymentRow[];
  categories: CategoryRow[];
  topProducts: { id: string; name: string; sku: string; quantity: number; revenue: number; profit?: number }[];
  slowMoving: { id: string; name: string; sku: string; stock: number; stockValue?: number }[];
  overdueCustomers: { id: string; name: string; phone: string; balance: number; creditLimit: number; oldestUnpaidDays: number }[];
}

const PRESETS = [
  ['today', 'Today'],
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['month', 'This month'],
  ['lastMonth', 'Last month'],
  ['custom', 'Custom'],
] as const;

const OVERDUE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

export default function SalesView() {
  const { API_BASE, secureFetch, user, isSandboxMode } = useShop();
  const isOwner = user?.role === 'OWNER';

  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const [custom, setCustom] = useState(() => presetRange('30d'));
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trendView, setTrendView] = useState<'chart' | 'table'>('chart');
  const requestId = useRef(0);

  const range = preset === 'custom' ? custom : presetRange(preset);
  const rangeError =
    preset !== 'custom'
      ? null
      : !custom.from || !custom.to
        ? 'Pick both dates.'
        : custom.from > custom.to
          ? 'The start date is after the end date.'
          : (new Date(custom.to).getTime() - new Date(custom.from).getTime()) / 86400000 > MAX_RANGE_DAYS
            ? 'Reports cover at most one year at a time.'
            : null;

  const load = useCallback(async () => {
    if (isSandboxMode || rangeError) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureFetch(`${API_BASE}/reports/summary?from=${range.from}&to=${range.to}`);
      if (id !== requestId.current) return;
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ? String(body.message) : `Could not load the report (HTTP ${res.status}).`);
        return;
      }
      setData(await res.json());
    } catch {
      if (id === requestId.current) setError('Could not reach the server.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [API_BASE, secureFetch, isSandboxMode, range.from, range.to, rangeError]);

  useEffect(() => {
    load();
  }, [load]);

  const k = data?.kpis;
  // Profit UI only for owners, and only when the server actually sent profit figures
  const showProfit = isOwner && k?.profit !== undefined;
  const firstLoad = !data && loading;

  if (isSandboxMode) {
    return <p className="text-sm text-neutral-500 py-12 text-center">Reports need the backend; they are not available in sandbox mode.</p>;
  }

  return (
    <div className="space-y-5">
      {/* Filters: one row above everything they scope */}
      <div className="flex flex-wrap items-center gap-2">
        <PillGroup value={preset} options={PRESETS} onChange={v => setPreset(v)} />
        {preset === 'custom' && (
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <input
              type="date"
              aria-label="From date"
              value={custom.from}
              max={custom.to || ymd(new Date())}
              onChange={e => setCustom(c => ({ ...c, from: e.target.value }))}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/60 [color-scheme:dark]"
            />
            <span>to</span>
            <input
              type="date"
              aria-label="To date"
              value={custom.to}
              min={custom.from}
              max={ymd(new Date())}
              onChange={e => setCustom(c => ({ ...c, to: e.target.value }))}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/60 [color-scheme:dark]"
            />
          </div>
        )}
        <span className="text-[11px] text-neutral-500 ml-1">
          {rangeError ? <span className="text-amber-400">{rangeError}</span> : range.from === range.to ? longDate(range.from) : `${longDate(range.from)} – ${longDate(range.to)}`}
        </span>
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-900/50 text-red-300 text-xs rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {firstLoad ? (
        <SalesSkeleton isOwner={isOwner} />
      ) : !data || !k ? null : (
        // Refetch keeps the frame: previous numbers stay, dimmed, until the new ones arrive
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
          <div className={`grid grid-cols-2 gap-3 ${showProfit ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            <StatTile label="Revenue" value={inr(k.revenue)} sub={`${inr(k.revenueBeforeGst)} before GST`} />
            <StatTile label="Bills" value={num(k.bills)} sub={k.creditOutstandingFromPeriod > 0 ? `${inr(k.creditOutstandingFromPeriod)} still on credit` : 'Fully collected'} />
            <StatTile label="Avg bill" value={inr(k.averageBill)} sub="Revenue per bill, incl. GST" />
            <StatTile label="GST collected" value={inr(k.gstCollected)} sub={`${pct(k.gstCollected, k.revenueBeforeGst)} of taxable sales`} />
            <StatTile label="Expenses" value={inr(k.expenses)} sub="Shop expenses booked" />
            <StatTile label="Returns" value={inr(k.returns.amount)} sub={`${k.returns.count} return${k.returns.count === 1 ? '' : 's'}`} />
            {showProfit && (
              <>
                <StatTile label="Gross profit" value={inr(k.profit)} sub={`${pct(k.profit ?? 0, k.revenueBeforeGst)} margin on sales ex-GST`} />
                <StatTile
                  label="Net profit"
                  value={inr(k.netProfit)}
                  tone={(k.netProfit ?? 0) < 0 ? 'loss' : undefined}
                  sub={(k.netProfit ?? 0) < 0 ? <span className="inline-flex items-center gap-1 text-red-400"><AlertTriangle className="w-3 h-3" />Loss after expenses</span> : 'Gross profit minus expenses'}
                />
              </>
            )}
          </div>

          <Card
            title={showProfit ? 'Daily revenue and gross profit' : 'Daily revenue'}
            subtitle="Revenue includes GST. Hover or use the arrow keys for each day's figures."
            action={
              <>
                {showProfit && (
                  <div className="hidden sm:flex items-center gap-3 mr-2 text-[11px] text-neutral-400">
                    <LegendLine color={SERIES[0]} label="Revenue" />
                    <LegendLine color={SERIES[1]} label="Gross profit" />
                  </div>
                )}
                <div className="flex rounded-lg border border-neutral-800 overflow-hidden text-[11px] font-semibold">
                  {(['chart', 'table'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setTrendView(v)}
                      className={`px-2.5 py-1 capitalize cursor-pointer ${trendView === v ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </>
            }
          >
            {data.daily.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-neutral-500">No sales in this period.</p>
            ) : trendView === 'chart' ? (
              <div className="px-2 pb-3">
                <TrendChart daily={data.daily} showProfit={showProfit} />
              </div>
            ) : (
              <DataTable
                rows={[...data.daily].reverse()}
                rowKey={d => d.date}
                maxHeight="320px"
                columns={[
                  { key: 'date', label: 'Date', render: d => longDate(d.date) },
                  { key: 'bills', label: 'Bills', align: 'right', render: d => d.bills },
                  { key: 'rev', label: 'Revenue', align: 'right', render: d => <span className="text-white">{inr(d.revenue)}</span> },
                  ...(showProfit ? [{ key: 'profit', label: 'Gross profit', align: 'right' as const, render: (d: DailyPoint) => inr(d.profit) }] : []),
                  { key: 'exp', label: 'Expenses', align: 'right', render: d => inr(d.expenses) },
                ]}
              />
            )}
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card title="Payment mix" subtitle="Share of revenue by how customers paid">
              <PaymentMix rows={data.paymentMix} />
            </Card>
            <Card title="Sales by category" subtitle={showProfit ? 'Sales before GST, with gross margin' : 'Sales before GST'}>
              <CategoryBars rows={data.categories} showProfit={showProfit} />
            </Card>
          </div>

          <Card title="Top products" subtitle="Best sellers in this period, by sales before GST">
            <DataTable
              rows={data.topProducts}
              rowKey={p => p.id}
              empty="No products sold in this period."
              columns={[
                { key: 'rank', label: '#', render: p => <span className="text-neutral-500 font-mono">{data.topProducts.indexOf(p) + 1}</span>, className: 'w-8' },
                { key: 'name', label: 'Product', render: p => <ProductCell name={p.name} sku={p.sku} /> },
                { key: 'qty', label: 'Qty sold', align: 'right', render: p => num(p.quantity) },
                { key: 'rev', label: 'Sales ex-GST', align: 'right', render: p => <span className="text-white">{inr(p.revenue)}</span> },
                ...(showProfit
                  ? [
                      { key: 'profit', label: 'Gross profit', align: 'right' as const, render: (p: Summary['topProducts'][number]) => inr(p.profit) },
                      { key: 'margin', label: 'Margin', align: 'right' as const, render: (p: Summary['topProducts'][number]) => <span className="text-neutral-400">{pct(p.profit ?? 0, p.revenue)}</span> },
                    ]
                  : []),
              ]}
            />
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card title="Slow-moving stock" subtitle="In stock, but nothing sold in this period">
              <DataTable
                rows={data.slowMoving}
                rowKey={p => p.id}
                maxHeight="520px"
                empty="Every item in stock sold at least once in this period."
                columns={[
                  { key: 'name', label: 'Product', render: p => <ProductCell name={p.name} sku={p.sku} /> },
                  { key: 'stock', label: 'In stock', align: 'right', render: p => num(p.stock) },
                  ...(showProfit
                    ? [{ key: 'value', label: 'Stock value', align: 'right' as const, render: (p: Summary['slowMoving'][number]) => <span className="text-white">{inr(p.stockValue)}</span> }]
                    : []),
                ]}
                footer={
                  showProfit && data.slowMoving.length > 0 ? (
                    <tr>
                      <td className="px-4 py-2.5">Capital tied up</td>
                      <td />
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{inr(data.slowMoving.reduce((s, p) => s + (p.stockValue ?? 0), 0))}</td>
                    </tr>
                  ) : undefined
                }
              />
            </Card>

            <Card title="Customers with dues" subtitle={`Unpaid credit balances; flagged when the oldest unpaid bill is over ${OVERDUE_DAYS} days old`}>
              <DataTable
                rows={[...data.overdueCustomers].sort((a, b) => b.oldestUnpaidDays - a.oldestUnpaidDays || b.balance - a.balance)}
                rowKey={c => c.id}
                maxHeight="520px"
                empty="No customer owes anything right now."
                columns={[
                  {
                    key: 'name',
                    label: 'Customer',
                    render: c => (
                      <div className="min-w-0">
                        <div className="text-white truncate">{c.name}</div>
                        <div className="text-[10px] text-neutral-500 font-mono">{c.phone}</div>
                      </div>
                    ),
                  },
                  {
                    key: 'bal',
                    label: 'Balance',
                    align: 'right',
                    render: c => (
                      <div>
                        <div className="text-white">{inr(c.balance)}</div>
                        {c.creditLimit > 0 && <div className="text-[10px] text-neutral-500">{pct(c.balance, c.creditLimit)} of {inr(c.creditLimit, 0)}</div>}
                      </div>
                    ),
                  },
                  {
                    key: 'days',
                    label: 'Oldest unpaid',
                    align: 'right',
                    render: c =>
                      c.oldestUnpaidDays > OVERDUE_DAYS ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border bg-red-950 text-red-400 border-red-900/40 font-sans">
                          <AlertTriangle className="w-3 h-3" />
                          {c.oldestUnpaidDays} days · overdue
                        </span>
                      ) : (
                        <span className="text-neutral-400">{c.oldestUnpaidDays === 0 ? 'Today' : `${c.oldestUnpaidDays} day${c.oldestUnpaidDays === 1 ? '' : 's'}`}</span>
                      ),
                  },
                ]}
              />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendLine({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-3.5 h-0.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function ProductCell({ name, sku }: { name: string; sku: string }) {
  return (
    <div className="min-w-0">
      <div className="text-white">{name}</div>
      <div className="text-[10px] text-neutral-500 font-mono">{sku}</div>
    </div>
  );
}

function SalesSkeleton({ isOwner }: { isOwner: boolean }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading report">
      <div className={`grid grid-cols-2 gap-3 ${isOwner ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {Array.from({ length: isOwner ? 8 : 6 }).map((_, i) => (
          <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-2">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        ))}
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-[230px] w-full" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {[0, 1].map(i => (
          <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
            <Skeleton className="h-3 w-32" />
            {Array.from({ length: 5 }).map((_, j) => <Skeleton key={j} className="h-4 w-full" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
