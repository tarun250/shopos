'use client';

// Overlays driven by the POS checkout flow in page.tsx (approval wait, loss warning, success receipt)

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';

export interface LossWarningState {
  show: boolean;
  breaches: any[];
  bypassAction: () => void;
}

interface PendingApprovalOverlayProps {
  pendingBillId: string | null;
  pendingBillNumber: string | null;
  pendingBillStatus: string | null;
  pendingBillReason: string | null;
  pendingBillApprover: string | null;
  pendingBillRejectReason: string | null;
  handleCancelPendingRequest: () => void;
}

// OVERLAY A: Floating Asynchronous Approval Wait Overlay
export function PendingApprovalOverlay({
  pendingBillId,
  pendingBillNumber,
  pendingBillStatus,
  pendingBillReason,
  pendingBillApprover,
  pendingBillRejectReason,
  handleCancelPendingRequest,
}: PendingApprovalOverlayProps) {
  return (
    <AnimatePresence>
      {pendingBillId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl w-full max-w-[420px] shadow-2xl relative text-center space-y-6"
          >
            {pendingBillStatus === 'APPROVED_NOTIFY' ? (
              // APPROVED VIEW
              <div className="space-y-4">
                <div className="w-16 h-16 bg-green-500/10 text-green-500 border border-green-550/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-400 tracking-tight">Approved by Manager</h3>
                  <p className="text-xs text-neutral-400 mt-2">
                    Request was approved by <span className="text-white font-semibold">{pendingBillApprover}</span>. Finalizing checkout receipt...
                  </p>
                </div>
              </div>
            ) : pendingBillStatus === 'REJECTED' ? (
              // REJECTED VIEW
              <div className="space-y-4">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 border border-red-550/20 rounded-full flex items-center justify-center mx-auto">
                  <XCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-400 tracking-tight">Request Rejected</h3>
                  <p className="text-xs text-neutral-400 mt-2">
                    Pricing override request was rejected.
                  </p>
                  <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-850 mt-4 text-xs font-mono text-left space-y-1">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Rejection Reason:</span>
                      <span className="text-red-400 font-semibold">{pendingBillRejectReason}</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleCancelPendingRequest}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold py-2.5 rounded-lg w-full cursor-pointer transition-colors"
                  >
                    Return to Cart (Edit Bill)
                  </button>
                </div>
              </div>
            ) : (
              // PENDING VIEW
              <div className="space-y-4">
                <div className="w-16 h-16 bg-amber-500/10 text-amber-500 border border-amber-550/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Approval Pending</h3>
                  <p className="text-xs text-neutral-400 mt-2">
                    A pricing override request has been queued. Please wait for a manager or owner to authorize this from their dashboard.
                  </p>
                  <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-850 mt-4 text-xs font-mono text-left space-y-1">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Bill Ref:</span>
                      <span className="text-white">{pendingBillNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Reason:</span>
                      <span className="text-amber-400">{pendingBillReason}</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleCancelPendingRequest}
                    className="bg-neutral-850 hover:bg-neutral-850/80 text-neutral-300 text-xs font-semibold py-2.5 rounded-lg w-full cursor-pointer transition-colors"
                  >
                    Cancel & Edit Bill
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface LossWarningModalProps {
  lossWarningModal: LossWarningState | null;
  setLossWarningModal: (value: LossWarningState | null) => void;
}

// OVERLAY A2: Highly Visible Loss Sale Warning Modal for Owners
export function LossWarningModal({ lossWarningModal, setLossWarningModal }: LossWarningModalProps) {
  return (
    <AnimatePresence>
      {lossWarningModal?.show && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900 border border-red-500/30 p-6 rounded-2xl w-full max-w-[400px] shadow-2xl relative space-y-4"
          >
            <div className="flex items-center gap-3 text-red-500 pb-2 border-b border-neutral-800">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
              <h3 className="text-base font-bold tracking-tight">Loss Sale Warning</h3>
            </div>

            <p className="text-xs text-neutral-400">
              You are about to sell items below cost price. Please verify the loss details below:
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {lossWarningModal.breaches.map((b, idx) => (
                <div key={idx} className="bg-red-950/20 border border-red-900/40 p-3 rounded-lg text-xs space-y-1 font-mono">
                  <div className="font-bold text-white">{b.productName}</div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Cost Price:</span>
                    <span className="text-white">₹{b.costPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Selling Price:</span>
                    <span className="text-red-400 font-semibold">₹{b.sellingPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-red-950/40 pt-1 mt-1 text-[10px]">
                    <span className="text-red-400">Loss Amount:</span>
                    <span className="text-red-400 font-bold">₹{b.loss.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-red-400">Profit Margin:</span>
                    <span className="text-red-400 font-bold">{b.margin}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button 
                onClick={() => setLossWarningModal(null)}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs py-2 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={lossWarningModal.bypassAction}
                className="bg-red-600 hover:bg-red-555 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer transition-colors"
              >
                Proceed Anyway
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface CheckoutSuccessModalProps {
  checkoutResult: any | null;
  setCheckoutResult: (value: any | null) => void;
  clearCart: () => void;
}

// OVERLAY B: Checkout Success Modal
export function CheckoutSuccessModal({ checkoutResult, setCheckoutResult, clearCart }: CheckoutSuccessModalProps) {
  return (
    <AnimatePresence>
      {checkoutResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[380px] shadow-2xl relative"
          >
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {checkoutResult.isQuote ? 'Quotation Saved' : 'Transaction Success'}
                </h3>
                <p className="text-xs text-neutral-500 font-mono mt-1">{checkoutResult.billNumber}</p>
              </div>

              <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-850 space-y-2 text-sm text-left">
                <div className="flex justify-between">
                  <span className="text-neutral-400 text-xs">Total Amount:</span>
                  <strong className="text-white font-mono">₹{checkoutResult.netAmount.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400 text-xs">Tendered Amount:</span>
                  <span className="text-neutral-300 font-mono">₹{checkoutResult.paidAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-800 pt-2 font-semibold">
                  <span className="text-neutral-400 text-xs">Change to Return:</span>
                  <strong className="text-green-400 font-mono text-base">₹{checkoutResult.changeAmount.toFixed(2)}</strong>
                </div>
              </div>

              <button 
                onClick={() => {
                  setCheckoutResult(null);
                  clearCart();
                }}
                className="w-full bg-white hover:bg-neutral-200 text-neutral-950 font-bold py-2.5 rounded-xl transition-colors cursor-pointer text-xs"
              >
                Start New Bill
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
