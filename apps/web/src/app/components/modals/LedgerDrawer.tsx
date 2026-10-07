'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Coins, RotateCcw } from 'lucide-react';
import { useShop } from '../../ShopContext';

interface LedgerDrawerProps {
  ledgerDrawerOpen: boolean;
  setLedgerDrawerOpen: (open: boolean) => void;
  selectedLedgerDetails: any | null;
  selectedLedgerType: 'CUSTOMER' | 'SUPPLIER' | null;
  // (Re)loads a statement; used after recording a payment
  handleOpenLedgerDrawer: (id: string, type: 'CUSTOMER' | 'SUPPLIER') => void;
}

// DRAWER: Advanced Customer/Supplier Ledger Timeline Statements (shared by both ledger tabs)
export default function LedgerDrawer({
  ledgerDrawerOpen,
  setLedgerDrawerOpen,
  selectedLedgerDetails,
  selectedLedgerType,
  handleOpenLedgerDrawer,
}: LedgerDrawerProps) {
  const { API_BASE, secureFetch, user } = useShop();

  // Manual payment entries
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentMethodSelect, setPaymentMethodSelect] = useState('CASH');

  const handleRecordLedgerPayment = async () => {
    if (!selectedLedgerDetails) return;
    const amountVal = Number(paymentAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Please enter a valid positive payment amount.');
      return;
    }

    try {
      const isCust = selectedLedgerType === 'CUSTOMER';
      const endpoint = isCust
        ? `${API_BASE}/billing/customers/${selectedLedgerDetails.customer.id}/payments`
        : `${API_BASE}/billing/suppliers/${selectedLedgerDetails.supplier.id}/payments`;

      const res = await secureFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountVal,
          paymentMethod: paymentMethodSelect,
          notes: paymentNotes,
          userId: user?.userId || 'SYSTEM'
        })
      });

      if (res.ok) {
        alert('Payment recorded successfully!');
        setPaymentAmount('');
        setPaymentNotes('');
        handleOpenLedgerDrawer(
          isCust ? selectedLedgerDetails.customer.id : selectedLedgerDetails.supplier.id,
          selectedLedgerType!
        );
      } else {
        const err = await res.json();
        alert(err.message || 'Payment recording failed.');
      }
    } catch (err) {
      alert('Network error recording ledger payment.');
    }
  };

  return (
    <AnimatePresence>
      {ledgerDrawerOpen && selectedLedgerDetails && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLedgerDrawerOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />
          {/* Slide-over */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-[480px] h-full bg-neutral-900 border-l border-neutral-850 flex flex-col shadow-2xl z-10"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-neutral-850 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold text-white">
                  {selectedLedgerType === 'CUSTOMER' ? 'Customer Account Statement' : 'Supplier Credit Timeline'}
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  {selectedLedgerType === 'CUSTOMER' 
                    ? selectedLedgerDetails.customer.name 
                    : selectedLedgerDetails.supplier.name
                  }
                </p>
              </div>
              <button 
                onClick={() => setLedgerDrawerOpen(false)}
                className="text-neutral-400 hover:text-white text-xs cursor-pointer bg-neutral-850 hover:bg-neutral-800 p-2 rounded-lg"
              >
                Close
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Total Balance Card */}
              <div className="bg-neutral-950/60 border border-neutral-850 rounded-2xl p-5 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">Outstanding balance</span>
                  <span className={`text-2xl font-mono font-bold mt-1 block ${
                    (selectedLedgerDetails.ledger?.[0]?.runningBalance || 0) > 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    ₹{(selectedLedgerDetails.ledger?.[0]?.runningBalance || 0.0).toFixed(2)}
                  </span>
                </div>
                <div className="bg-neutral-900 border border-neutral-850 p-2.5 rounded-xl text-neutral-400">
                  <Coins className="w-5 h-5" />
                </div>
              </div>

              {/* Record Payment Form */}
              <div className="bg-neutral-950/30 border border-neutral-850 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Record Cash/UPI Payment</h4>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-neutral-500 block mb-1">Payment Amount (₹)</label>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                  {selectedLedgerType === 'CUSTOMER' && (
                    <div>
                      <label className="text-[9px] text-neutral-500 block mb-1">Payment Mode</label>
                      <select 
                        value={paymentMethodSelect}
                        onChange={e => setPaymentMethodSelect(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-850 rounded-lg px-2 py-2 text-xs text-neutral-300 focus:outline-none"
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="CARD">Debit/Credit Card</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[9px] text-neutral-500 block mb-1">Notes / References</label>
                  <input 
                    type="text"
                    placeholder="Receipt info, check details..."
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <button 
                  onClick={handleRecordLedgerPayment}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-colors"
                >
                  Post Transaction Ledger
                </button>
              </div>

              {/* Timeline Stream */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Transaction Timeline Stream</h4>
                
                <div className="space-y-3 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-neutral-850">
                  {selectedLedgerDetails.ledger.map((item: any) => {
                    const isInvoice = item.transactionType === 'SALE' || item.transactionType === 'PURCHASE';
                    const isReturn = item.transactionType === 'RETURN';
                    
                    return (
                      <div key={item.id} className="flex gap-4 relative">
                        <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 z-10 ${
                          isInvoice 
                            ? 'bg-neutral-900 border-neutral-800 text-neutral-400' 
                            : isReturn 
                              ? 'bg-green-950/20 border-green-900/40 text-green-400' 
                              : 'bg-violet-950/20 border-violet-900/40 text-violet-400'
                        }`}>
                          {isInvoice ? (
                            <BookOpen className="w-3.5 h-3.5" />
                          ) : isReturn ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : (
                            <Coins className="w-3.5 h-3.5" />
                          )}
                        </div>

                        <div className="bg-neutral-950/30 border border-neutral-850 p-4 rounded-xl flex-1 space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-white">
                              {item.transactionType} 
                              {item.bill?.billNumber ? ` (${item.bill.billNumber})` : ''}
                              {item.salesReturn?.returnNumber ? ` (${item.salesReturn.returnNumber})` : ''}
                              {item.purchaseOrder?.poNumber ? ` (${item.purchaseOrder.poNumber})` : ''}
                              {item.purchaseReturn?.returnNumber ? ` (${item.purchaseReturn.returnNumber})` : ''}
                            </span>
                            <span className="font-mono text-neutral-500 text-[10px]">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] font-mono text-neutral-400">
                            <div>
                              <span className="text-neutral-600 block">Debit (+)</span>
                              <span className="text-red-400 font-semibold">₹{item.debit.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-neutral-600 block">Credit (-)</span>
                              <span className="text-green-400 font-semibold">₹{item.credit.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-neutral-600 block">Balance</span>
                              <span className="text-white font-semibold">₹{item.runningBalance.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
