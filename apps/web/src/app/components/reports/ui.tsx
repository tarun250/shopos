'use client';

import React from 'react';
import { Download } from 'lucide-react';

// Chart colours for the dark surface (neutral-900 #171717). Categorical slots 1-4 of the
// reference palette's dark steps, validated as an ordered set against #171717
// (all checks pass: worst adjacent CVD ΔE 8.4, normal-vision ΔE 19.8, all >= 3:1).
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500'] as const;
export const CHART = {
  surface: '#171717',
  grid: '#2a2a2a',
  baseline: '#404040',
  axisText: '#8a8a8a',
  other: '#6b6b6b',
};

export function Card({ title, subtitle, action, children, className = '' }: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-neutral-900 border border-neutral-800 rounded-xl ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
            {subtitle && <p className="text-[11px] text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub, tone }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'loss';
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 min-w-0">
      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">{label}</span>
      <p className={`text-lg font-bold font-mono mt-1 truncate ${tone === 'loss' ? 'text-red-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-neutral-800/70 ${className}`} />;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-xs text-neutral-500">{children}</div>;
}

export function PillGroup<T extends string>({ value, options, onChange }: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            value === v ? 'bg-white text-neutral-950' : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function CsvButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 text-neutral-300 hover:text-white hover:border-violet-500/50 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Download className="w-3.5 h-3.5" />
      Download CSV
    </button>
  );
}

export interface Column<T> {
  key: string;
  label: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T>({ columns, rows, rowKey, footer, empty, maxHeight }: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  footer?: React.ReactNode;
  empty?: React.ReactNode;
  maxHeight?: string;
}) {
  if (rows.length === 0) return <Empty>{empty ?? 'Nothing to show for this period.'}</Empty>;
  const alignClass = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');
  return (
    <div className={`overflow-x-auto ${maxHeight ? 'overflow-y-auto' : ''}`} style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-neutral-900 z-10">
          <tr className="border-y border-neutral-800 text-neutral-500">
            {columns.map(c => (
              <th key={c.key} className={`px-4 py-2.5 font-semibold whitespace-nowrap ${alignClass(c.align)}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)} className="hover:bg-neutral-800/30 transition-colors">
              {columns.map(c => (
                <td
                  key={c.key}
                  className={`px-4 py-2.5 ${alignClass(c.align)} ${c.align === 'right' ? 'font-mono tabular-nums whitespace-nowrap' : ''} ${c.className ?? ''}`}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot className="border-t border-neutral-700 text-white font-semibold">{footer}</tfoot>}
      </table>
    </div>
  );
}

// Width of an element, kept current with a ResizeObserver (charts draw at real pixel size).
// Callback ref, so it also works when the element mounts after the first render.
export function useWidth<T extends HTMLElement>() {
  const [el, setEl] = React.useState<T | null>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(entries => setWidth(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width] as const;
}
