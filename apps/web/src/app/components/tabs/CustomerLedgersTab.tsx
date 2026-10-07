'use client';

import React, { useEffect, useState } from 'react';
import TabPane from './TabPane';
import { useShop } from '../../ShopContext';

interface CustomerLedgersTabProps {
  // Opens the shared ledger statement drawer (rendered by page.tsx)
  handleOpenLedgerDrawer: (id: string, type: 'CUSTOMER' | 'SUPPLIER') => void;
}

export default function CustomerLedgersTab({ handleOpenLedgerDrawer }: CustomerLedgersTabProps) {
  const { API_BASE, secureFetch, isSandboxMode } = useShop();
  const [customerLedgers, setCustomerLedgers] = useState<any[]>([]);

  const fetchCustomersLedgersData = async () => {
    if (isSandboxMode) return;
    try {
      const res = await secureFetch(`${API_BASE}/billing/customers`);
      if (res.ok) {
        const data = await res.json();
        setCustomerLedgers(data);
      }
    } catch (err) {
      console.error('Error fetching customer ledgers:', err);
    }
  };

  useEffect(() => {
    fetchCustomersLedgersData();
  }, []);

  return (
    <TabPane className="flex-1 flex flex-col p-6 overflow-hidden h-full">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Customer Credit Ledgers</h2>
          <p className="text-xs text-neutral-400 mt-1">FIFO payments, credit limits, and running balance timelines.</p>
        </div>
      </div>

      <div className="flex-1 bg-neutral-900/60 border border-neutral-850 rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-850 bg-neutral-950/40 text-neutral-400 font-semibold">
                <th className="p-4">Customer Name</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Price Level</th>
                <th className="p-4">Credit Limit</th>
                <th className="p-4 text-right">Ledger Balance</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-850 text-neutral-300">
              {customerLedgers.map((c: any) => {
                const creditLimitVal = c.creditLimit || 0.0;
                return (
                  <tr key={c.id} className="hover:bg-neutral-850/30 transition-colors">
                    <td className="p-4 font-medium text-white">{c.name}</td>
                    <td className="p-4 font-mono text-neutral-400">{c.phone}</td>
                    <td className="p-4">
                      <span className="bg-violet-950/30 text-violet-400 border border-violet-900/40 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                        {c.priceLevel || 'RETAIL'}
                      </span>
                    </td>
                    <td className="p-4 font-mono">₹{creditLimitVal.toFixed(2)}</td>
                    <td className="p-4 text-right font-mono font-bold text-red-400">
                      ₹{(c.customerLedger?.[0]?.runningBalance || 0.0).toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleOpenLedgerDrawer(c.id, 'CUSTOMER')}
                        className="bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                      >
                        View Ledger Statement
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </TabPane>
  );
}
