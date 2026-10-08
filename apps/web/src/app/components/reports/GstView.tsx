'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { useShop } from '../../ShopContext';
import { Card, CsvButton, DataTable, Skeleton, StatTile } from './ui';
import { dateTime, downloadCsv, inr, num, ym, ymd } from './format';

interface GstReport {
  month: string;
  note: string;
  totals: { invoices: number; taxable: number; cgst: number; sgst: number };
  b2b: { billNumber: string; date: string; customer: string; gstin: string; taxable: number; cgst: number; sgst: number; invoiceValue: number }[];
  b2c: { taxable: number; cgst: number; sgst: number };
  rateWise: { rate: number; taxable: number; cgst: number; sgst: number }[];
  hsnSummary: { hsn: string; description: string; unit: string; quantity: number; taxable: number; cgst: number; sgst: number }[];
  creditNotes: { returnNumber: string; againstBill: string; date: string; taxable: number; cgst: number; sgst: number }[];
  liability: { outputCgst: number; outputSgst: number; inputCgst: number; inputSgst: number; netCgstPayable: number; netSgstPayable: number };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = <T,>(rows: T[], f: (r: T) => number) => r2(rows.reduce((s, r) => s + f(r), 0));

const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

export default function GstView() {
  const { API_BASE, secureFetch, isSandboxMode } = useShop();
  const [month, setMonth] = useState(() => ym(new Date()));
  const [data, setData] = useState<GstReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (isSandboxMode || !/^\d{4}-\d{2}$/.test(month)) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureFetch(`${API_BASE}/reports/gst?month=${month}`);
      if (id !== requestId.current) return;
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ? String(body.message) : `Could not load the GST report (HTTP ${res.status}).`);
        return;
      }
      setData(await res.json());
    } catch {
      if (id === requestId.current) setError('Could not reach the server.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [API_BASE, secureFetch, isSandboxMode, month]);

  useEffect(() => {
    load();
  }, [load]);

  if (isSandboxMode) {
    return <p className="text-sm text-neutral-500 py-12 text-center">GST reports need the backend; they are not available in sandbox mode.</p>;
  }

  const d = data;
  const file = (name: string) => `${name}-${d?.month ?? month}.csv`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          Return period
          <input
            type="month"
            value={month}
            max={ym(new Date())}
            onChange={e => e.target.value && setMonth(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/60 [color-scheme:dark]"
          />
        </label>
        <span className="text-[11px] text-neutral-500">{monthLabel(month)}</span>
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

      {!d && loading ? (
        <GstSkeleton />
      ) : !d ? null : (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
          {d.note && (
            <div role="note" className="flex items-start gap-2 bg-amber-950/30 border border-amber-900/50 text-amber-200 text-xs rounded-lg px-3 py-2.5">
              <Info className="w-4 h-4 shrink-0 text-amber-400 mt-px" />
              <span>{d.note}</span>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatTile label="Invoices" value={num(d.totals.invoices)} sub={`${d.b2b.length} B2B · ${d.totals.invoices - d.b2b.length} B2C`} />
            <StatTile label="Taxable value" value={inr(d.totals.taxable)} sub="Outward supplies" />
            <StatTile label="CGST" value={inr(d.totals.cgst)} sub="Charged on invoices" />
            <StatTile label="SGST" value={inr(d.totals.sgst)} sub="Charged on invoices" />
            <StatTile label="Total tax" value={inr(d.totals.cgst + d.totals.sgst)} sub={`Invoice value ${inr(d.totals.taxable + d.totals.cgst + d.totals.sgst, 0)}`} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            <Card title="Tax liability (GSTR-3B)" subtitle="Output tax after credit notes, less input tax credit on purchases" className="xl:col-span-3">
              <Liability l={d.liability} />
            </Card>
            <Card title="Supplies by type" subtitle="Registered (B2B) vs unregistered (B2C) buyers" className="xl:col-span-2">
              <DataTable
                rows={[
                  { type: 'B2B (with GSTIN)', taxable: sum(d.b2b, r => r.taxable), cgst: sum(d.b2b, r => r.cgst), sgst: sum(d.b2b, r => r.sgst) },
                  { type: 'B2C', ...d.b2c },
                ]}
                rowKey={r => r.type}
                columns={[
                  { key: 'type', label: 'Supply', render: r => <span className="text-white whitespace-nowrap">{r.type}</span> },
                  { key: 'tx', label: 'Taxable', align: 'right', render: r => inr(r.taxable) },
                  { key: 'tax', label: 'CGST + SGST', align: 'right', render: r => inr(r.cgst + r.sgst) },
                ]}
              />
            </Card>
          </div>

          <Card
            title="Rate-wise summary"
            subtitle="Taxable value and tax at each GST rate"
            action={
              <CsvButton
                disabled={d.rateWise.length === 0}
                onClick={() =>
                  downloadCsv(file('gst-rate-wise'), ['GST rate (%)', 'Taxable value', 'CGST', 'SGST', 'Total tax'],
                    d.rateWise.map(r => [r.rate, r.taxable, r.cgst, r.sgst, r2(r.cgst + r.sgst)]))
                }
              />
            }
          >
            <DataTable
              rows={d.rateWise}
              rowKey={r => String(r.rate)}
              empty="No taxable sales this month."
              columns={[
                { key: 'rate', label: 'Rate', render: r => <span className="text-white font-mono">{r.rate}%</span> },
                { key: 'split', label: 'CGST / SGST', render: r => <span className="text-neutral-500 font-mono">{r.rate / 2}% + {r.rate / 2}%</span> },
                { key: 'tx', label: 'Taxable value', align: 'right', render: r => inr(r.taxable) },
                { key: 'c', label: 'CGST', align: 'right', render: r => inr(r.cgst) },
                { key: 's', label: 'SGST', align: 'right', render: r => inr(r.sgst) },
                { key: 't', label: 'Total tax', align: 'right', render: r => <span className="text-white">{inr(r.cgst + r.sgst)}</span> },
              ]}
              footer={
                d.rateWise.length > 1 ? (
                  <TotalsRow lead={2} cells={[sum(d.rateWise, r => r.taxable), sum(d.rateWise, r => r.cgst), sum(d.rateWise, r => r.sgst), sum(d.rateWise, r => r.cgst + r.sgst)]} />
                ) : undefined
              }
            />
          </Card>

          <Card
            title="HSN summary"
            subtitle="For Table 12 of GSTR-1"
            action={
              <CsvButton
                disabled={d.hsnSummary.length === 0}
                onClick={() =>
                  downloadCsv(file('gst-hsn-summary'), ['HSN', 'Description', 'UQC', 'Total quantity', 'Taxable value', 'CGST', 'SGST', 'Total tax'],
                    d.hsnSummary.map(h => [h.hsn, h.description, h.unit, h.quantity, h.taxable, h.cgst, h.sgst, r2(h.cgst + h.sgst)]))
                }
              />
            }
          >
            <DataTable
              rows={d.hsnSummary}
              rowKey={(h, i) => `${h.hsn}-${i}`}
              maxHeight="420px"
              empty="No HSN-wise sales this month."
              columns={[
                { key: 'hsn', label: 'HSN', render: h => <span className="text-white font-mono">{h.hsn || '—'}</span> },
                { key: 'desc', label: 'Description', render: h => h.description },
                { key: 'qty', label: 'Qty', align: 'right', render: h => <>{num(h.quantity)} <span className="text-neutral-500 font-sans">{h.unit}</span></> },
                { key: 'tx', label: 'Taxable value', align: 'right', render: h => inr(h.taxable) },
                { key: 'c', label: 'CGST', align: 'right', render: h => inr(h.cgst) },
                { key: 's', label: 'SGST', align: 'right', render: h => inr(h.sgst) },
              ]}
              footer={
                d.hsnSummary.length > 1 ? (
                  <TotalsRow lead={3} cells={[sum(d.hsnSummary, h => h.taxable), sum(d.hsnSummary, h => h.cgst), sum(d.hsnSummary, h => h.sgst)]} />
                ) : undefined
              }
            />
          </Card>

          <Card
            title="B2B invoices"
            subtitle="Invoices to GST-registered buyers (GSTR-1 Table 4)"
            action={
              <CsvButton
                disabled={d.b2b.length === 0}
                onClick={() =>
                  downloadCsv(file('gst-b2b-invoices'), ['Invoice number', 'Invoice date', 'Customer', 'GSTIN', 'Taxable value', 'CGST', 'SGST', 'Invoice value'],
                    d.b2b.map(b => [b.billNumber, ymd(new Date(b.date)), b.customer, b.gstin, b.taxable, b.cgst, b.sgst, b.invoiceValue]))
                }
              />
            }
          >
            <DataTable
              rows={d.b2b}
              rowKey={b => b.billNumber}
              maxHeight="420px"
              empty="No invoices to registered businesses this month."
              columns={[
                { key: 'bill', label: 'Invoice', render: b => <span className="text-white font-mono">{b.billNumber}</span> },
                { key: 'date', label: 'Date', render: b => <span className="whitespace-nowrap text-neutral-400">{dateTime(b.date)}</span> },
                { key: 'cust', label: 'Customer', render: b => <span className="text-white">{b.customer}</span> },
                { key: 'gstin', label: 'GSTIN', render: b => <span className="font-mono text-neutral-400">{b.gstin}</span> },
                { key: 'tx', label: 'Taxable', align: 'right', render: b => inr(b.taxable) },
                { key: 'tax', label: 'CGST + SGST', align: 'right', render: b => inr(b.cgst + b.sgst) },
                { key: 'val', label: 'Invoice value', align: 'right', render: b => <span className="text-white">{inr(b.invoiceValue)}</span> },
              ]}
            />
          </Card>

          <Card title="Credit notes" subtitle="Sales returns this month; already deducted from output tax above">
            <DataTable
              rows={d.creditNotes}
              rowKey={c => c.returnNumber}
              empty="No credit notes this month."
              columns={[
                { key: 'no', label: 'Credit note', render: c => <span className="text-white font-mono">{c.returnNumber}</span> },
                { key: 'bill', label: 'Against invoice', render: c => <span className="font-mono text-neutral-400">{c.againstBill}</span> },
                { key: 'date', label: 'Date', render: c => <span className="whitespace-nowrap text-neutral-400">{dateTime(c.date)}</span> },
                { key: 'tx', label: 'Taxable', align: 'right', render: c => inr(c.taxable) },
                { key: 'c', label: 'CGST', align: 'right', render: c => inr(c.cgst) },
                { key: 's', label: 'SGST', align: 'right', render: c => inr(c.sgst) },
              ]}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

function TotalsRow({ lead, cells }: { lead: number; cells: number[] }) {
  return (
    <tr>
      <td className="px-4 py-2.5" colSpan={lead}>Total</td>
      {cells.map((c, i) => (
        <td key={i} className="px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">{inr(c)}</td>
      ))}
    </tr>
  );
}

function Liability({ l }: { l: GstReport['liability'] }) {
  const rows: { label: string; hint: string; c: number; s: number; strong?: boolean; minus?: boolean }[] = [
    { label: 'Output tax', hint: 'GST charged on sales, net of credit notes', c: l.outputCgst, s: l.outputSgst },
    { label: 'Input tax credit', hint: 'GST paid on purchases', c: l.inputCgst, s: l.inputSgst, minus: true },
    { label: 'Net payable', hint: 'To be paid in cash', c: l.netCgstPayable, s: l.netSgstPayable, strong: true },
  ];
  const fmt = (v: number, minus?: boolean) => (minus && v > 0 ? `− ${inr(v)}` : v < 0 ? `(${inr(-v)})` : inr(v));
  const netTotal = l.netCgstPayable + l.netSgstPayable;
  return (
    <div className="pb-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-y border-neutral-800 text-neutral-500">
            <th className="px-4 py-2.5 text-left font-semibold" />
            <th className="px-4 py-2.5 text-right font-semibold">CGST</th>
            <th className="px-4 py-2.5 text-right font-semibold">SGST</th>
            <th className="px-4 py-2.5 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className={r.strong ? 'border-t border-neutral-700' : ''}>
              <td className="px-4 py-2.5">
                <div className={r.strong ? 'text-white font-semibold' : 'text-neutral-200'}>{r.label}</div>
                <div className="text-[10px] text-neutral-500">{r.hint}</div>
              </td>
              {[r.c, r.s, r.c + r.s].map((v, i) => (
                <td key={i} className={`px-4 py-2.5 text-right font-mono tabular-nums whitespace-nowrap ${r.strong ? 'text-white font-bold text-sm' : 'text-neutral-300'}`}>
                  {fmt(v, r.minus)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {netTotal < 0 && (
        <p className="px-4 pt-1 text-[11px] text-neutral-400">
          Input credit exceeds output tax; the excess {inr(-netTotal)} carries forward to next month.
        </p>
      )}
    </div>
  );
}

function GstSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading GST report">
      <Skeleton className="h-9 w-full" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-2">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
      {[0, 1].map(i => (
        <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
          <Skeleton className="h-3 w-40" />
          {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-4 w-full" />)}
        </div>
      ))}
    </div>
  );
}
