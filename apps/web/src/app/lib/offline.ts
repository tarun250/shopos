import Dexie, { Table } from 'dexie';

// Offline support: a cache of catalogue data for billing without the server, and a queue of
// bills made offline that are sent to the server (idempotently, by clientRef) once it is back.

export interface QueuedBill {
  clientRef: string;
  payload: any; // the exact body for POST /billing/bills
  createdAt: string;
  status: 'pending' | 'failed';
  attempts: number;
  error?: string;
  summary: { total: number; items: number; customer?: string };
}

interface CacheRow {
  key: string;
  value: unknown;
  updatedAt: string;
}

class OfflineDb extends Dexie {
  bills!: Table<QueuedBill, string>;
  cache!: Table<CacheRow, string>;

  constructor() {
    super('shopos-offline');
    this.version(1).stores({ bills: 'clientRef, status, createdAt', cache: 'key' });
  }
}

let db: OfflineDb | null = null;
const getDb = () => (db ??= new OfflineDb());

export async function cacheSet(key: string, value: unknown) {
  try {
    await getDb().cache.put({ key, value, updatedAt: new Date().toISOString() });
  } catch {
    // Storage can be unavailable (private mode, quota); offline mode then just has no cache
  }
}

export async function cacheGet<T>(key: string): Promise<{ value: T; updatedAt: string } | null> {
  try {
    const row = await getDb().cache.get(key);
    return row ? { value: row.value as T, updatedAt: row.updatedAt } : null;
  } catch {
    return null;
  }
}

export function newClientRef() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `offline-${crypto.randomUUID()}`
    : `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueBill(payload: any, summary: QueuedBill['summary']): Promise<QueuedBill> {
  const clientRef = payload.billData.clientRef || newClientRef();
  const item: QueuedBill = {
    clientRef,
    payload: { ...payload, billData: { ...payload.billData, clientRef, offlineCreatedAt: new Date().toISOString() } },
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
    summary,
  };
  await getDb().bills.put(item);
  return item;
}

export async function listQueuedBills(): Promise<QueuedBill[]> {
  try {
    return await getDb().bills.orderBy('createdAt').toArray();
  } catch {
    return [];
  }
}

export async function removeQueuedBill(clientRef: string) {
  await getDb().bills.delete(clientRef);
}

/** A fetch rejection (not an HTTP error status) means the server could not be reached. */
export const isNetworkError = (err: unknown) => err instanceof TypeError || (err as any)?.name === 'TypeError';

let syncing = false;

/**
 * Sends pending offline bills. Network failures leave them queued; a business rejection
 * (e.g. credit limit) marks the bill failed so a manager can review it. Safe to call often.
 */
export async function syncQueuedBills(post: (payload: any) => Promise<Response>): Promise<{ synced: number; failed: number; remaining: number; offline: boolean }> {
  if (syncing) return { synced: 0, failed: 0, remaining: (await listQueuedBills()).length, offline: false };
  syncing = true;
  let synced = 0;
  let failed = 0;
  let offline = false;
  try {
    const pending = (await listQueuedBills()).filter(b => b.status === 'pending');
    for (const bill of pending) {
      try {
        const res = await post(bill.payload);
        if (res.ok) {
          await removeQueuedBill(bill.clientRef);
          synced++;
        } else if (res.status === 401 || res.status >= 500) {
          // Not logged in or server trouble: try again later
          await getDb().bills.update(bill.clientRef, { attempts: bill.attempts + 1 });
          break;
        } else {
          const body = await res.json().catch(() => ({}));
          await getDb().bills.update(bill.clientRef, { status: 'failed', attempts: bill.attempts + 1, error: Array.isArray(body.message) ? body.message.join('; ') : body.message || `HTTP ${res.status}` });
          failed++;
        }
      } catch (err) {
        if (isNetworkError(err)) {
          offline = true;
          break;
        }
        throw err;
      }
    }
  } finally {
    syncing = false;
  }
  return { synced, failed, remaining: (await listQueuedBills()).length, offline };
}

export async function retryFailedBill(clientRef: string) {
  await getDb().bills.update(clientRef, { status: 'pending', error: undefined });
}
