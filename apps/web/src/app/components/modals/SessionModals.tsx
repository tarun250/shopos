'use client';

// Day session (opening / closing) and expense dialogs, opened from the POS banner and the command palette

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShop } from '../../ShopContext';

interface OpeningSessionModalProps {
  showOpeningModal: boolean;
  setShowOpeningModal: (show: boolean) => void;
  setActiveSession: (session: any) => void;
}

// OVERLAY J: Day Session Opening Checklist Modal
export function OpeningSessionModal({ showOpeningModal, setShowOpeningModal, setActiveSession }: OpeningSessionModalProps) {
  const { API_BASE, secureFetch, user } = useShop();
  const [openingCash, setOpeningCash] = useState('0');
  const [openingCard, setOpeningCard] = useState('0');
  const [openingUpi, setOpeningUpi] = useState('0');
  const [openingNotes, setOpeningNotes] = useState('');

  const handleOpenSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = Number(openingCash || 0);
    const card = Number(openingCard || 0);
    const upi = Number(openingUpi || 0);
    if (cash < 0 || card < 0 || upi < 0) {
      alert('Opening balances cannot be negative.');
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/session/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openingUser: user?.username || 'cashier',
          openingCash: cash,
          openingCard: card,
          openingUpi: upi,
          openingNotes
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data);
        setShowOpeningModal(false);
        alert('Day session opened successfully!');
      } else {
        throw new Error(await res.text());
      }
    } catch (err: any) {
      alert(`Open session failed: ${err.message}`);
    }
  };

  return (
    <AnimatePresence>
      {showOpeningModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[420px] shadow-2xl relative space-y-4"
          >
            <h3 className="text-base font-bold text-white tracking-tight">Open New Day Session</h3>
            <p className="text-xs text-neutral-400">Initialize counts to activate billing operations.</p>

            <form onSubmit={handleOpenSessionSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Opening Cash (₹)</label>
                  <input 
                    type="number" 
                    value={openingCash}
                    onChange={e => setOpeningCash(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Card Balance (₹)</label>
                  <input 
                    type="number" 
                    value={openingCard}
                    onChange={e => setOpeningCard(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">UPI Balance (₹)</label>
                  <input 
                    type="number" 
                    value={openingUpi}
                    onChange={e => setOpeningUpi(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Opening Notes</label>
                <input 
                  type="text" 
                  placeholder="Morning shift opening checklist done..."
                  value={openingNotes}
                  onChange={e => setOpeningNotes(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-850 space-y-1.5 text-[10px] text-neutral-400">
                <div className="flex items-center gap-2"><input type="checkbox" required /> <span>Verified physical cash drawer totals</span></div>
                <div className="flex items-center gap-2"><input type="checkbox" required /> <span>POS terminal sync is online</span></div>
                <div className="flex items-center gap-2"><input type="checkbox" required /> <span>Check counter clean and cards reader active</span></div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowOpeningModal(false)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-white hover:bg-neutral-200 text-neutral-950 font-bold py-2 rounded-lg cursor-pointer"
                >
                  Confirm Opening
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface ClosingSessionModalProps {
  showClosingModal: boolean;
  setShowClosingModal: (show: boolean) => void;
  setActiveSession: (session: any) => void;
}

// OVERLAY K: Day Closing Worksheet & Differences Modal
export function ClosingSessionModal({ showClosingModal, setShowClosingModal, setActiveSession }: ClosingSessionModalProps) {
  const { API_BASE, secureFetch, user, fetchAllData } = useShop();
  const [actualCash, setActualCash] = useState('0');
  const [closingNotes, setClosingNotes] = useState('');

  const handleCloseSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const actual = Number(actualCash || 0);
    if (actual < 0) {
      alert('Counted physical cash cannot be negative.');
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/session/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualCash: actual,
          closingNotes,
          userId: user?.userId || 'SYSTEM'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data);
        setShowClosingModal(false);
        alert('Day session closed successfully!');
        fetchAllData();
      } else {
        throw new Error(await res.text());
      }
    } catch (err: any) {
      alert(`Close session failed: ${err.message}`);
    }
  };

  return (
    <AnimatePresence>
      {showClosingModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[420px] shadow-2xl relative space-y-4"
          >
            <h3 className="text-base font-bold text-white tracking-tight">Close Active Day Session</h3>
            <p className="text-xs text-neutral-400">Submit counts to calculate expected-vs-actual drawer differences.</p>

            <form onSubmit={handleCloseSessionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Physical Cash Counted (₹)</label>
                <input 
                  type="number" 
                  value={actualCash}
                  onChange={e => setActualCash(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Closing Notes / Explanations</label>
                <textarea 
                  rows={2}
                  placeholder="Explain any counted discrepancies..."
                  value={closingNotes}
                  onChange={e => setClosingNotes(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowClosingModal(false)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-red-600 hover:bg-red-550 text-white font-bold py-2 rounded-lg cursor-pointer animate-pulse"
                >
                  Submit Closing count
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface ExpenseModalProps {
  showExpenseModal: boolean;
  setShowExpenseModal: (show: boolean) => void;
  fetchExpenses: () => void;
  fetchActiveSession: () => void;
}

// OVERLAY L: Expense Management Modal
export function ExpenseModal({ showExpenseModal, setShowExpenseModal, fetchExpenses, fetchActiveSession }: ExpenseModalProps) {
  const { API_BASE, secureFetch } = useShop();
  const [expenseCategory, setExpenseCategory] = useState('TEA');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseDeductDrawer, setExpenseDeductDrawer] = useState(true);

  const handleCreateExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expenseAmount || 0);
    if (isNaN(amt) || amt <= 0) {
      alert('Expense amount must be a positive number.');
      return;
    }
    if (!expenseNotes.trim()) {
      alert('Expense description is required.');
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expenseCategory,
          amount: amt,
          notes: expenseNotes,
          deductFromDrawer: expenseDeductDrawer
        })
      });
      if (res.ok) {
        alert('Expense logged successfully!');
        setExpenseAmount('');
        setExpenseNotes('');
        setShowExpenseModal(false);
        fetchExpenses();
        fetchActiveSession();
      } else {
        throw new Error(await res.text());
      }
    } catch (err: any) {
      alert(`Log expense failed: ${err.message}`);
    }
  };

  return (
    <AnimatePresence>
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[420px] shadow-2xl relative space-y-4"
          >
            <h3 className="text-base font-bold text-white tracking-tight">Log Expense Receipt</h3>
            <p className="text-xs text-neutral-400">Log tea, salaries, rentals, transport, or fuel expenses.</p>

            <form onSubmit={handleCreateExpenseSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Category</label>
                  <select 
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-neutral-300 focus:outline-none"
                  >
                    <option value="TEA">Tea & Snacks</option>
                    <option value="FUEL">Fuel / Conveyance</option>
                    <option value="TRANSPORT">Freight / Transport</option>
                    <option value="SALARY">Staff Salaries</option>
                    <option value="RENT">Rent & Utilities</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="CUSTOM">Custom Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Amount (₹)</label>
                  <input 
                    type="number" 
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Description / Notes</label>
                <input 
                  type="text" 
                  placeholder="e.g. Tea for mechanic team"
                  value={expenseNotes}
                  onChange={e => setExpenseNotes(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={expenseDeductDrawer}
                  onChange={e => setExpenseDeductDrawer(e.target.checked)}
                />
                <span className="text-[10px] text-neutral-400">Deduct directly from cash drawer balance</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowExpenseModal(false)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-white hover:bg-neutral-200 text-neutral-950 font-bold py-2 rounded-lg cursor-pointer"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
