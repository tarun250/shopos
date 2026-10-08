'use client';

import React, { useMemo, useState } from 'react';
import { CHART, SERIES, useWidth } from './ui';
import { inr, inrCompact, longDate, shortDate } from './format';

export interface DailyPoint {
  date: string;
  revenue: number;
  bills: number;
  expenses: number;
  profit?: number;
}

const M = { top: 14, right: 64, bottom: 28, left: 56 };
const PLOT_H = 210;
const HEIGHT = PLOT_H + M.top + M.bottom;

function niceStep(range: number, target: number) {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

// Daily revenue (and gross profit for owners) on one ₹ axis. Crosshair snaps to the nearest day.
export default function TrendChart({ daily, showProfit }: { daily: DailyPoint[]; showProfit: boolean }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const n = daily.length;
  const plotW = Math.max(0, width - M.left - M.right);

  const scale = useMemo(() => {
    const values = daily.flatMap(d => (showProfit && d.profit !== undefined ? [d.revenue, d.profit] : [d.revenue]));
    const lo = Math.min(0, ...values);
    const hi = Math.max(1, ...values);
    const step = niceStep(hi - lo || 1, 4);
    const min = Math.floor(lo / step) * step;
    const max = Math.ceil(hi / step) * step;
    const ticks: number[] = [];
    for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
    return { min, max, ticks };
  }, [daily, showProfit]);

  const x = (i: number) => M.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => M.top + PLOT_H - ((v - scale.min) / (scale.max - scale.min || 1)) * PLOT_H;

  const linePath = (get: (d: DailyPoint) => number) =>
    daily.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(get(d)).toFixed(1)}`).join('');
  const revenueLine = linePath(d => d.revenue);
  const revenueArea = n > 1 ? `${revenueLine}L${x(n - 1).toFixed(1)},${y(Math.max(0, scale.min))}L${x(0).toFixed(1)},${y(Math.max(0, scale.min))}Z` : '';
  const hasProfit = showProfit && daily.some(d => d.profit !== undefined);
  const profitLine = hasProfit ? linePath(d => d.profit ?? 0) : '';

  // ~7 date labels max, always including the last day
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 90))));
  const xLabels = daily
    .map((d, i) => ({ i, d }))
    .filter(({ i }) => (n - 1 - i) % labelEvery === 0);

  const onPointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (n === 0) return;
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left - M.left;
    const i = n <= 1 ? 0 : Math.round((px / plotW) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (n === 0) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive(a => Math.min(n - 1, (a ?? -1) + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive(a => Math.max(0, (a ?? n) - 1)); }
    if (e.key === 'Escape') setActive(null);
  };

  const last = daily[n - 1];
  const endRevY = last ? y(last.revenue) : 0;
  const endProfitY = last && hasProfit ? y(last.profit ?? 0) : 0;
  const endLabelsFit = !hasProfit || Math.abs(endRevY - endProfitY) >= 14;
  const showDots = n <= 12;

  const a = active !== null ? daily[active] : null;
  const tipLeft = active !== null ? x(active) : 0;
  const tipOnLeft = tipLeft > width - 200;

  return (
    <div
      ref={wrapRef}
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 rounded-lg"
      style={{ height: HEIGHT }}
      tabIndex={0}
      role="img"
      aria-label={`Daily revenue${hasProfit ? ' and gross profit' : ''} chart, ${n} days. Use the arrow keys to read each day.`}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg width={width} height={HEIGHT} className="block select-none">
          {/* gridlines + y ticks */}
          {scale.ticks.map(t => (
            <g key={t}>
              <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHART.baseline : CHART.grid} strokeWidth={1} />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={CHART.axisText} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {inrCompact(t)}
              </text>
            </g>
          ))}
          {/* x labels */}
          {xLabels.map(({ i, d }) => (
            <text key={d.date} x={x(i)} y={M.top + PLOT_H + 18} textAnchor={n > 1 && i === n - 1 ? 'end' : n > 1 && i === 0 ? 'start' : 'middle'} fontSize={10} fill={CHART.axisText}>
              {shortDate(d.date)}
            </text>
          ))}

          {/* series */}
          {revenueArea && <path d={revenueArea} fill={SERIES[0]} opacity={0.1} />}
          <path d={revenueLine} fill="none" stroke={SERIES[0]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hasProfit && <path d={profitLine} fill="none" stroke={SERIES[1]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

          {showDots && daily.map((d, i) => (
            <g key={d.date}>
              <circle cx={x(i)} cy={y(d.revenue)} r={4} fill={SERIES[0]} stroke={CHART.surface} strokeWidth={2} />
              {hasProfit && <circle cx={x(i)} cy={y(d.profit ?? 0)} r={4} fill={SERIES[1]} stroke={CHART.surface} strokeWidth={2} />}
            </g>
          ))}

          {/* direct end labels (legend carries identity when they would collide) */}
          {last && endLabelsFit && (
            <g fontSize={10} fill="#c3c2b7">
              <text x={x(n - 1) + 8} y={endRevY} dy="0.32em">Revenue</text>
              {hasProfit && <text x={x(n - 1) + 8} y={endProfitY} dy="0.32em">Profit</text>}
            </g>
          )}

          {/* crosshair */}
          {a && active !== null && (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + PLOT_H} stroke="#a3a3a3" strokeWidth={1} />
              <circle cx={x(active)} cy={y(a.revenue)} r={5} fill={SERIES[0]} stroke={CHART.surface} strokeWidth={2} />
              {hasProfit && <circle cx={x(active)} cy={y(a.profit ?? 0)} r={5} fill={SERIES[1]} stroke={CHART.surface} strokeWidth={2} />}
            </g>
          )}

          {/* hit layer: the whole plot, so the reader aims at a date, not a 2px line */}
          <rect
            x={M.left - 8}
            y={M.top}
            width={plotW + 16}
            height={PLOT_H}
            fill="transparent"
            onPointerMove={onPointerMove}
            onPointerDown={onPointerMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}

      {a && active !== null && (
        <div
          className="pointer-events-none absolute z-20 min-w-[170px] rounded-lg border border-neutral-700 bg-neutral-950/95 px-3 py-2 shadow-xl"
          style={{
            top: M.top,
            left: tipOnLeft ? undefined : tipLeft + 12,
            right: tipOnLeft ? width - tipLeft + 12 : undefined,
          }}
          role="status"
        >
          <p className="text-[11px] text-neutral-400 mb-1.5">{longDate(a.date)}</p>
          <TipRow color={SERIES[0]} label="Revenue" value={inr(a.revenue)} />
          {hasProfit && <TipRow color={SERIES[1]} label="Gross profit" value={inr(a.profit ?? 0)} />}
          <div className="mt-1.5 pt-1.5 border-t border-neutral-800 space-y-0.5 text-[11px] text-neutral-400">
            <div className="flex justify-between gap-4"><span>Bills</span><span className="font-mono text-neutral-200">{a.bills}</span></div>
            <div className="flex justify-between gap-4"><span>Expenses</span><span className="font-mono text-neutral-200">{inr(a.expenses)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="inline-block w-3 h-0.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-sm font-bold font-mono text-white">{value}</span>
      <span className="text-[11px] text-neutral-400 ml-auto pl-3">{label}</span>
    </div>
  );
}
