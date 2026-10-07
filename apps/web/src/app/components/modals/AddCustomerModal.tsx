'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShop } from '../../ShopContext';
import type { Customer } from '../../types';

export interface AddCustomerForm {
  show: boolean;
  name: string;
  phone: string;
  priceLevel: string;
  creditLimit: string;
}

interface AddCustomerModalProps {
  addCustomer: AddCustomerForm;
  setAddCustomer: React.Dispatch<React.SetStateAction<AddCustomerForm>>;
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
  handleSelectCustomer: (customer: Customer) => void;
}

export default function AddCustomerModal({ addCustomer, setAddCustomer, customers, setCustomers, handleSelectCustomer }: AddCustomerModalProps) {
  const { API_BASE, secureFetch, user, isSandboxMode } = useShop();

  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCustomer.name.trim() || !addCustomer.phone.trim()) {
      alert('Customer Name and Phone number are required.');
      return;
    }
    const limit = Number(addCustomer.creditLimit);
    if (isNaN(limit) || limit < 0) {
      alert('Credit limit must be a positive number.');
      return;
    }

    if (isSandboxMode) {
      const newCust: Customer = {
        id: `local-cust-${Date.now()}`,
        name: addCustomer.name,
        phone: addCustomer.phone,
        email: null,
        gstin: null,
        address: null,
        creditLimit: Number(addCustomer.creditLimit) || 10000,
        balance: 0,
        priceLevel: addCustomer.priceLevel,
      };
      setCustomers([...customers, newCust]);
      setAddCustomer({ show: false, name: '', phone: '', priceLevel: 'RETAIL', creditLimit: '10000' });
      handleSelectCustomer(newCust);
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/billing/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addCustomer.name,
          phone: addCustomer.phone,
          priceLevel: addCustomer.priceLevel,
          creditLimit: Number(addCustomer.creditLimit),
        }),
      });

      if (res.ok) {
        const freshCust = await res.json();
        setCustomers([...customers, freshCust]);
        setAddCustomer({ show: false, name: '', phone: '', priceLevel: 'RETAIL', creditLimit: '10000' });
        handleSelectCustomer(freshCust);
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to add customer');
      }
    } catch (e) {
      alert('Connection error registering customer');
    }
  };

  return (
    <AnimatePresence>
      {addCustomer.show && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[360px] shadow-2xl relative"
          >
            <h3 className="text-base font-bold text-white mb-1">Register New Customer</h3>
            <p className="text-xs text-neutral-400 mb-4">Set pricing level tier and credit limit limits immediately.</p>

            <form onSubmit={handleAddCustomerSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Customer Name</label>
                <input 
                  type="text"
                  value={addCustomer.name}
                  placeholder="Enter full name"
                  onChange={e => setAddCustomer({ ...addCustomer, name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Mobile Number</label>
                <input 
                  type="text"
                  value={addCustomer.phone}
                  placeholder="10-digit mobile"
                  onChange={e => setAddCustomer({ ...addCustomer, phone: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Pricing Level</label>
                <select 
                  value={addCustomer.priceLevel}
                  onChange={e => setAddCustomer({ ...addCustomer, priceLevel: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="RETAIL">Retail Pricing (Standard)</option>
                  <option value="WHOLESALE">Wholesale Pricing (Tier 1)</option>
                  <option value="CONTRACTOR">Contractor Pricing (Tier 2)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Credit Limit {user?.role !== 'OWNER' && '(Owner-only field)'}
                </label>
                <input 
                  type="number"
                  disabled={user?.role !== 'OWNER'}
                  value={addCustomer.creditLimit}
                  onChange={e => setAddCustomer({ ...addCustomer, creditLimit: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono disabled:opacity-55"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setAddCustomer({ show: false, name: '', phone: '', priceLevel: 'RETAIL', creditLimit: '10000' })}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-semibold py-2 rounded-lg cursor-pointer"
                >
                  Create Customer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
