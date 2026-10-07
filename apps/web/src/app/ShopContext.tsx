'use client';

import { createContext, useContext } from 'react';
import type { ActiveUser, SecureFetch } from './types';

// API base URL
export const API_BASE = 'http://localhost:3001';

// Session-wide values every tab and modal needs. Screen-specific data is passed as props.
export interface ShopContextValue {
  API_BASE: string;
  secureFetch: SecureFetch;
  user: ActiveUser;
  isSandboxMode: boolean;
  // Reloads products, customers, lookup lists and the day session (page.tsx)
  fetchAllData: () => Promise<void>;
}

export const ShopContext = createContext<ShopContextValue | null>(null);

export function useShop(): ShopContextValue {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop() must be used inside the signed-in ShopOS shell');
  return ctx;
}
