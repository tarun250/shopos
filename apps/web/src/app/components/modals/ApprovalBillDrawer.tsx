'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ApprovalBillDrawerProps {
  selectedApprovalBill: any | null;
  setSelectedApprovalBill: (bill: any | null) => void;
}

// Side drawer to view bill details inside Approval Center
export default function ApprovalBillDrawer({ selectedApprovalBill, setSelectedApprovalBill }: ApprovalBillDrawerProps) {
  return (
    <AnimatePresence>
      {selectedApprovalBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="bg-neutral-900 border-l border-neutral-800 w-full max-w-md h-full flex flex-col p-6 shadow-2xl relative"
          >
            <div className="flex justify-between items-center pb-4 border-b border-neutral-850">
              <div>
                <h3 className="text-base font-bold text-white">Bill Summary Details</h3>
                <p className="text-xs text-neutral-500">Bill Number: {selectedApprovalBill.billNumber}</p>
              </div>
              <button 
                onClick={() => setSelectedApprovalBill(null)}
                className="text-neutral-400 hover:text-white text-xl cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Cart Items</h4>
              <div className="space-y-2">
                {selectedApprovalBill.items?.map((item: any, idx: number) => {
                  return (
                    <div key={idx} className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-850 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-white">{item.product?.name || 'Product'}</p>
                        <p className="text-[10px] text-neutral-500 font-mono">Qty: {item.quantity} x ₹{item.unitPrice} (Disc: ₹{item.discount})</p>
                      </div>
                      <div className="text-right font-mono font-semibold text-white">
                        ₹{item.totalPrice.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-neutral-850 pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Subtotal:</span>
                  <span>₹{selectedApprovalBill.totalAmount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Tax (GST):</span>
                  <span>₹{(selectedApprovalBill.cgstAmount + selectedApprovalBill.sgstAmount)?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-bold pt-1 border-t border-neutral-850/50">
                  <span>Net Total:</span>
                  <span>₹{selectedApprovalBill.netAmount?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-850 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-neutral-500 block">Payment Method</span>
                <span className="font-semibold text-white">{selectedApprovalBill.paymentMethod}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Paid Amount</span>
                <span className="font-semibold text-white">₹{selectedApprovalBill.paidAmount?.toFixed(2)}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
