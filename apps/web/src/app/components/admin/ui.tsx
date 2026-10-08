'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

// Shared building blocks for the owner-only admin screens (Users & Shop, AI Quality).

export const inputClass =
  'w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600';
export const primaryButton =
  'px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white cursor-pointer flex items-center gap-1.5';
export const secondaryButton =
  'px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 cursor-pointer';
export const ghostButton =
  'flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50';

// Turns a failed response into readable text; class-validator sends { message: string[] | string }.
export async function apiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  const msg = (body as any)?.message;
  if (Array.isArray(msg) && msg.length) return msg.map(m => capitalize(String(m))).join('. ');
  if (typeof msg === 'string' && msg) return capitalize(msg);
  if (res.status === 403) return 'You do not have permission to do this.';
  return `${fallback} (HTTP ${res.status})`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type PillTone = 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'neutral';
const PILL_TONES: Record<PillTone, string> = {
  green: 'bg-green-950 text-green-400 border-green-900/40',
  red: 'bg-red-950 text-red-400 border-red-900/40',
  amber: 'bg-amber-950 text-amber-400 border-amber-900/40',
  blue: 'bg-blue-950 text-blue-400 border-blue-900/40',
  violet: 'bg-violet-950 text-violet-300 border-violet-900/40',
  neutral: 'bg-neutral-800 text-neutral-400 border-neutral-700/40',
};

export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span className={`inline-block text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border whitespace-nowrap ${PILL_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4" title={hint}>
      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">{label}</span>
      <p className={`text-lg font-bold font-mono mt-1 ${tone || 'text-white'}`}>{value}</p>
      {hint && <p className="text-[10px] text-neutral-500 mt-0.5 truncate">{hint}</p>}
    </div>
  );
}

export function Field({ label, help, error, children }: { label: string; help?: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">{label}</span>
      {children}
      {error ? <p className="text-[10px] text-red-400">{error}</p> : help ? <p className="text-[10px] text-neutral-500">{help}</p> : null}
    </label>
  );
}

// Modal with backdrop; Escape and backdrop click close it unless `busy`.
export function Modal({
  title,
  onClose,
  busy,
  width = 'max-w-md',
  footer,
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  width?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    // Capture phase: something on the page stops keydown from bubbling past document, so a bubbling window listener never sees Escape from inputs
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, busy]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className={`bg-neutral-900 border border-neutral-800 rounded-2xl w-full ${width} max-h-[90vh] flex flex-col shadow-2xl`}
      >
        <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-800">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="text-neutral-400 hover:text-white cursor-pointer disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-4 border-t border-neutral-800">{footer}</div>}
      </div>
    </div>
  );
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return 'Never';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(value).toLocaleDateString();
}
