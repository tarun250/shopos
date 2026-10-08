'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CloudOff, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import { listQueuedBills, QueuedBill, removeQueuedBill, retryFailedBill } from '../lib/offline';

interface Props {
  offline: boolean;
  queueVersion: number; // bump to reload the queue list
  syncing: boolean;
  onSyncNow: () => void;
  catalogueCachedAt: string | null;
}

/** Shows offline status and bills waiting to sync; lets staff retry or discard bills the server rejected. */
export default function OfflineBanner({ offline, queueVersion, syncing, onSyncNow, catalogueCachedAt }: Props) {
  const [queue, setQueue] = useState<QueuedBill[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    listQueuedBills().then(setQueue);
  }, [queueVersion, open]);

  const pending = queue.filter(b => b.status === 'pending');
  const failed = queue.filter(b => b.status === 'failed');
  if (!offline && queue.length === 0) return null;

  const tone = failed.length ? 'bg-red-950/60 border-red-900/60 text-red-200' : offline ? 'bg-amber-950/60 border-amber-900/60 text-amber-100' : 'bg-blue-950/50 border-blue-900/60 text-blue-100';

  return (
    <>
      <div className={`flex items-center justify-between gap-3 px-4 py-2 border-b text-xs ${tone}`} role="status">
        <div className="flex items-center gap-2">
          {offline ? <CloudOff className="w-4 h-4 shrink-0" /> : syncing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>
            {offline
              ? `Offline: billing continues from the saved catalogue${catalogueCachedAt ? ` (updated ${new Date(catalogueCachedAt).toLocaleString()})` : ''}. Cash, UPI and card bills are saved on this device and sync automatically.`
              : syncing
                ? 'Back online, syncing saved bills…'
                : 'Some offline bills still need attention.'}
            {pending.length > 0 && <strong className="ml-1">{pending.length} waiting to sync.</strong>}
            {failed.length > 0 && <strong className="ml-1">{failed.length} rejected by the server.</strong>}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {queue.length > 0 && (
            <button onClick={() => setOpen(true)} className="underline underline-offset-2 cursor-pointer">Review</button>
          )}
          {!offline && pending.length > 0 && (
            <button onClick={onSyncNow} disabled={syncing} className="flex items-center gap-1 underline underline-offset-2 cursor-pointer disabled:opacity-50">
              <RefreshCw className="w-3 h-3" /> Sync now
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white">Bills saved on this device</h3>
              <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
              {queue.length === 0 && <p className="text-neutral-500">Nothing waiting. All offline bills have synced.</p>}
              {queue.map(b => (
                <div key={b.clientRef} className={`rounded-lg border p-3 ${b.status === 'failed' ? 'border-red-900/60 bg-red-950/20' : 'border-neutral-800 bg-neutral-950/60'}`}>
                  <div className="flex justify-between">
                    <span className="font-mono text-white">OFFLINE-{b.clientRef.slice(-6).toUpperCase()}</span>
                    <span className="font-mono text-white">₹{b.summary.total.toFixed(2)}</span>
                  </div>
                  <p className="text-neutral-500 mt-1">
                    {new Date(b.createdAt).toLocaleString()} · {b.summary.items} items · {b.summary.customer || 'Walk-in'} · {b.payload.billData.paymentMethod}
                  </p>
                  {b.status === 'failed' && (
                    <div className="mt-2 space-y-2">
                      <p className="text-red-300">Rejected: {b.error}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => { await retryFailedBill(b.clientRef); setQueue(await listQueuedBills()); onSyncNow(); }}
                          className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                        >
                          Retry
                        </button>
                        <button
                          onClick={async () => {
                            if (!window.confirm('Discard this bill? It will not be recorded on the server. Make sure the sale is handled another way.')) return;
                            await removeQueuedBill(b.clientRef);
                            setQueue(await listQueuedBills());
                          }}
                          className="px-3 py-1 rounded bg-neutral-800 hover:bg-red-900 text-red-300 cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Discard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
