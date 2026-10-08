'use client';

import React, { useState } from 'react';
import { CHART, Empty, SERIES, useWidth } from './ui';
import { inr, pct } from './format';

// ---------- Payment mix: one 100% stacked bar (part-to-whole, <= 5 parts) + a legend that doubles as the table ----------

// Colour follows the method, never its rank, so a method keeps its colour across periods.
const METHOD_ORDER = ['CASH', 'UPI', 'CARD', 'CREDIT'] as const;
const METHOD_LABEL: Record<string, string> = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', CREDIT: 'Credit (udhaar)' };
const methodColor = (m: string) => {
  const i = METHOD_ORDER.indexOf(m as (typeof METHOD_ORDER)[number]);
  return i >= 0 ? SERIES[i] : CHART.other;
};

export interface PaymentRow { method: string; amount: number; bills: number }

export function PaymentMix({ rows }: { rows: PaymentRow[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (rows.length === 0 || total <= 0) return <Empty>No sales in this period.</Empty>;

  const rank = (m: string) => {
    const i = METHOD_ORDER.indexOf(m as (typeof METHOD_ORDER)[number]);
    return i >= 0 ? i : 99;
  };
  const ordered = [...rows].filter(r => r.amount > 0).sort((a, b) => rank(a.method) - rank(b.method));

  const BAR_H = 20;
  const GAP = 2;
  let cursor = 0;
  const segs = ordered.map((r, i) => {
    const w = (r.amount / total) * width;
    const seg = { ...r, x: cursor, w: Math.max(0, w - (i < ordered.length - 1 ? GAP : 0)) };
    cursor += w;
    return seg;
  });
  const hovered = segs.find(s => s.method === hover);

  return (
    <div className="px-4 pb-4">
      <div ref={ref} className="relative" style={{ height: BAR_H }}>
        {width > 0 && (
          <svg width={width} height={BAR_H} className="block" role="img" aria-label="Share of sales by payment method">
            <defs>
              <clipPath id="paymix-clip"><rect width={width} height={BAR_H} rx={4} /></clipPath>
            </defs>
            <g clipPath="url(#paymix-clip)">
              {segs.map(s => (
                <rect
                  key={s.method}
                  x={s.x}
                  y={0}
                  width={s.w}
                  height={BAR_H}
                  fill={methodColor(s.method)}
                  opacity={hover && hover !== s.method ? 0.45 : 1}
                  onPointerEnter={() => setHover(s.method)}
                  onPointerLeave={() => setHover(null)}
                />
              ))}
            </g>
          </svg>
        )}
        {hovered && (
          <div
            className="pointer-events-none absolute z-20 bottom-full mb-2 rounded-lg border border-neutral-700 bg-neutral-950/95 px-3 py-2 shadow-xl whitespace-nowrap"
            style={{ left: Math.min(Math.max(0, hovered.x + hovered.w / 2 - 80), Math.max(0, width - 170)) }}
          >
            <p className="text-sm font-bold font-mono text-white">{inr(hovered.amount)}</p>
            <p className="text-[11px] text-neutral-400">{METHOD_LABEL[hovered.method] ?? hovered.method} · {pct(hovered.amount, total)} · {hovered.bills} bills</p>
          </div>
        )}
      </div>

      <table className="w-full text-xs mt-4">
        <tbody className="divide-y divide-neutral-800/60">
          {ordered.map(r => (
            <tr
              key={r.method}
              onPointerEnter={() => setHover(r.method)}
              onPointerLeave={() => setHover(null)}
              className={hover === r.method ? 'bg-neutral-800/40' : ''}
            >
              <td className="py-2 pr-2">
                <span className="flex items-center gap-2 text-neutral-200">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: methodColor(r.method) }} />
                  {METHOD_LABEL[r.method] ?? r.method}
                </span>
              </td>
              <td className="py-2 text-right text-neutral-500 font-mono tabular-nums whitespace-nowrap">{r.bills} bills</td>
              <td className="py-2 pl-3 text-right text-neutral-400 font-mono tabular-nums">{pct(r.amount, total)}</td>
              <td className="py-2 pl-3 text-right text-white font-mono tabular-nums whitespace-nowrap">{inr(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Categories: horizontal bars, one hue (nominal categories never get a value ramp) ----------

export interface CategoryRow { category: string; revenue: number; profit?: number }

const MAX_CATEGORY_BARS = 8;

export function CategoryBars({ rows, showProfit }: { rows: CategoryRow[]; showProfit: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
  if (sorted.length === 0) return <Empty>No category sales in this period.</Empty>;

  // Fold the tail into "Other" rather than growing the list
  let shown: (CategoryRow & { other?: boolean })[] = sorted;
  if (sorted.length > MAX_CATEGORY_BARS) {
    const tail = sorted.slice(MAX_CATEGORY_BARS - 1);
    shown = [
      ...sorted.slice(0, MAX_CATEGORY_BARS - 1),
      {
        category: `Other (${tail.length})`,
        revenue: tail.reduce((s, r) => s + r.revenue, 0),
        profit: showProfit ? tail.reduce((s, r) => s + (r.profit ?? 0), 0) : undefined,
        other: true,
      },
    ];
  }
  const total = sorted.reduce((s, r) => s + r.revenue, 0);
  const max = Math.max(...shown.map(r => r.revenue), 1);

  return (
    <div className="px-4 pb-4">
      <div className={`grid gap-x-3 text-[11px] text-neutral-500 font-semibold pb-1.5 ${showProfit ? 'grid-cols-[minmax(90px,140px)_1fr_auto_auto]' : 'grid-cols-[minmax(90px,140px)_1fr_auto]'}`}>
        <span>Category</span><span />
        <span className="text-right">Sales ex-GST</span>
        {showProfit && <span className="text-right w-14">Margin</span>}
      </div>
      <ul className="space-y-1">
        {shown.map((r, i) => {
          const share = (r.revenue / max) * 100;
          return (
            <li
              key={r.category}
              className={`relative grid items-center gap-x-3 rounded-md py-1 ${showProfit ? 'grid-cols-[minmax(90px,140px)_1fr_auto_auto]' : 'grid-cols-[minmax(90px,140px)_1fr_auto]'} ${hover === i ? 'bg-neutral-800/40' : ''}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              tabIndex={0}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              <span className="text-xs text-neutral-200 truncate pl-1" title={r.category}>{r.category}</span>
              <svg height={14} width="100%" className="block" aria-hidden>
                {/* 4px rounded data-end, square at the baseline */}
                <rect x={0} y={0} width={`${share}%`} height={14} rx={4} fill={r.other ? CHART.other : SERIES[0]} opacity={hover !== null && hover !== i ? 0.55 : 1} />
                <rect x={0} y={0} width={Math.min(4, share)} height={14} fill={r.other ? CHART.other : SERIES[0]} opacity={hover !== null && hover !== i ? 0.55 : 1} />
              </svg>
              <span className="text-xs text-white font-mono tabular-nums text-right whitespace-nowrap">{inr(r.revenue, 0)}</span>
              {showProfit && (
                <span className="text-xs text-neutral-400 font-mono tabular-nums text-right w-14">
                  {r.profit !== undefined ? pct(r.profit, r.revenue) : '–'}
                </span>
              )}
              {hover === i && (
                <div className="pointer-events-none absolute z-20 left-[150px] bottom-full mb-1 rounded-lg border border-neutral-700 bg-neutral-950/95 px-3 py-2 shadow-xl whitespace-nowrap">
                  <p className="text-sm font-bold font-mono text-white">{inr(r.revenue)}</p>
                  <p className="text-[11px] text-neutral-400">
                    {r.category} · {pct(r.revenue, total)} of sales
                    {showProfit && r.profit !== undefined && <> · profit {inr(r.profit)}</>}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
