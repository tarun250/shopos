// Formatting, date and CSV helpers shared by the Reports & GST screen.

// Sign goes before the symbol: −₹10,789.22, never ₹-10,789.22
export const inr = (n: number | null | undefined, digits = 2) => {
  const v = n ?? 0;
  const body = Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${v < 0 && Number(body.replace(/,/g, '')) !== 0 ? '−' : ''}₹${body}`;
};

export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

// Short axis labels in Indian units: ₹800, ₹12k, ₹1.5L, ₹2.1Cr
export function inrCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  const trim = (v: number) => (v >= 10 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, ''));
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}k`;
  return `${sign}₹${Math.round(abs)}`;
}

export const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '–');

// Local calendar date as YYYY-MM-DD (toISOString would shift to UTC).
export function ymd(d: Date): string {
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const ym = (d: Date) => ymd(d).slice(0, 7);

// '2026-10-08' -> Date at local midnight
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const shortDate = (s: string) =>
  parseYmd(s.slice(0, 10)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const longDate = (s: string) =>
  parseYmd(s.slice(0, 10)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom';

export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, now = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = (days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  switch (preset) {
    case 'today':
      return { from: ymd(today), to: ymd(today) };
    case '7d':
      return { from: ymd(back(6)), to: ymd(today) };
    case '30d':
      return { from: ymd(back(29)), to: ymd(today) };
    case 'month':
      return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) };
    case 'lastMonth':
      return {
        from: ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: ymd(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
  }
}

// ---------- CSV ----------

type Cell = string | number | null | undefined;

// RFC 4180 quoting; text cells that a spreadsheet would run as a formula get a leading apostrophe.
function csvCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'number' ? String(v) : v;
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  // BOM so Excel opens the ₹-free UTF-8 text (customer names, descriptions) correctly
  const blob = new Blob(['﻿' + toCsv(header, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
