'use client';

import React, { useEffect, useState } from 'react';
import TabPane from './TabPane';
import { useShop } from '../../ShopContext';

interface SupplierLedgersTabProps {
  // Opens the shared ledger statement drawer (rendered by page.tsx)
  handleOpenLedgerDrawer: (id: string, type: 'CUSTOMER' | 'SUPPLIER') => void;
}

export default function SupplierLedgersTab({ handleOpenLedgerDrawer }: SupplierLedgersTabProps) {
  const { API_BASE, secureFetch, isSandboxMode } = useShop();
  const [supplierLedgers, setSupplierLedgers] = useState<any[]>([]);

  const fetchSuppliersLedgersData = async () => {
    if (isSandboxMode) return;
    try {
      const res = await secureFetch(`${API_BASE}/billing/suppliers`);
      if (res.ok) {
        const data = await res.json();
        setSupplierLedgers(data);
      }
    } catch (err) {
      console.error('Error fetching supplier ledgers:', err);
    }
  };

  useEffect(() => {
    fetchSuppliersLedgersData();
  }, []);

  return (
    <TabPane className="flex-1 flex flex-col p-6 overflow-hidden h-full">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Supplier Liabilities</h2>
          <p className="text-xs text-neutral-400 mt-1">Purchase timelines, credit histories, and manual payments.</p>
        </div>
      </div>

      <div className="flex-1 bg-neutral-900/60 border border-neutral-850 rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-850 bg-neutral-950/40 text-neutral-400 font-semibold">
                <th className="p-4">Supplier Name</th>
                <th className="p-4">Contact Person</th>
                <th className="p-4">Phone</th>
                <th className="p-4 text-right">Outstanding Bal</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-850 text-neutral-300">
              {supplierLedgers.map((s: any) => {
                return (
                  <tr key={s.id} className="hover:bg-neutral-850/30 transition-colors">
                    <td className="p-4 font-medium text-white">{s.name}</td>
                    <td className="p-4 text-neutral-400">{s.contactPerson || 'N/A'}</td>
                    <td className="p-4 font-mono text-neutral-400">{s.phone}</td>
                    <td className="p-4 text-right font-mono font-bold text-amber-500">
                      ₹{(s.supplierLedger?.[0]?.runningBalance || 0.0).toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleOpenLedgerDrawer(s.id, 'SUPPLIER')}
                        className="bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                      >
                        View Statement
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
