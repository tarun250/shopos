'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';

interface OrderDetailDrawerProps {
  selectedOrder: any | null;
  setSelectedOrder: (order: any | null) => void;
  orderDetailLoading: boolean;
  setOrderDetailLoading: (loading: boolean) => void;
  startReturnFromOrder: (billNumber: string) => void;
}

// Slide-over with one bill's items, totals, payments, returns and approvals (Escape handling lives in page.tsx)
export default function OrderDetailDrawer({
  selectedOrder,
  setSelectedOrder,
  orderDetailLoading,
  setOrderDetailLoading,
  startReturnFromOrder,
}: OrderDetailDrawerProps) {
  return (
    <AnimatePresence>
      {(selectedOrder || orderDetailLoading) && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end"
          onClick={() => { setSelectedOrder(null); setOrderDetailLoading(false); }}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            onClick={e => e.stopPropagation()}
            className="bg-neutral-900 border-l border-neutral-800 w-full max-w-lg h-full flex flex-col shadow-2xl"
          >
            {orderDetailLoading || !selectedOrder ? (
              <div className="p-6 space-y-3 animate-pulse">
                <div className="h-5 bg-neutral-800 rounded w-1/2" />
                <div className="h-3 bg-neutral-800 rounded w-3/4" />
                <div className="h-3 bg-neutral-800 rounded w-2/3" />
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start p-6 border-b border-neutral-800">
                  <div>
                    <h3 className="text-base font-bold text-white font-mono">{selectedOrder.billNumber}</h3>
                    <p className="text-xs text-neutral-500 mt-1">
                      {new Date(selectedOrder.createdAt).toLocaleString()} · Billed by {selectedOrder.userName}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-2 text-neutral-400">
                      {selectedOrder.isQuote ? 'Quote' : selectedOrder.status.replace('_', ' ')} · {selectedOrder.paymentMethod}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-neutral-400 hover:text-white text-xl cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                  {/* Customer */}
                  <div className="bg-neutral-950/60 border border-neutral-850 rounded-lg p-3">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Customer</span>
                    <p className="text-white font-semibold mt-1">{selectedOrder.customer?.name || 'Walk-in customer'}</p>
                    {selectedOrder.customer && selectedOrder.customer.phone !== '0000000000' && (
                      <p className="text-neutral-500 font-mono">
                        {selectedOrder.customer.phone}
                        {selectedOrder.customer.gstin && ` · GSTIN ${selectedOrder.customer.gstin}`}
                      </p>
                    )}
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Items</h4>
                    {selectedOrder.items.map((item: any) => {
                      const returned = selectedOrder.returnedQty?.[item.productId] || 0;
                      return (
                        <div key={item.id} className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-850 flex justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{item.product?.name || 'Product'}</p>
                            <p className="text-[10px] text-neutral-500 font-mono">
                              {item.quantity} {item.product?.baseUnit?.abbreviation || ''} × ₹{item.unitPrice.toFixed(2)}
                              {item.discount > 0 && ` − ₹${item.discount.toFixed(2)} disc`}
                              {` · GST ${item.cgstRate + item.sgstRate}%`}
                            </p>
                            {returned > 0 && (
                              <p className="text-[10px] text-amber-400 font-semibold mt-1">{returned} returned</p>
                            )}
                          </div>
                          <div className="text-right font-mono font-semibold text-white whitespace-nowrap">₹{item.totalPrice.toFixed(2)}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Totals */}
                  <div className="border-t border-neutral-800 pt-4 space-y-1.5">
                    {[
                      ['Taxable value', selectedOrder.totalAmount],
                      ['CGST', selectedOrder.cgstAmount],
                      ['SGST', selectedOrder.sgstAmount],
                      ...(selectedOrder.discountAmount > 0 ? [['Bill discount', -selectedOrder.discountAmount]] : []),
                    ].map(([label, value]: any) => (
                      <div key={label} className="flex justify-between text-neutral-400">
                        <span>{label}</span>
                        <span className="font-mono">₹{value.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-white font-bold pt-1.5 border-t border-neutral-850">
                      <span>Net total</span>
                      <span className="font-mono">₹{selectedOrder.netAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Paid</span>
                      <span className="font-mono">₹{selectedOrder.paidAmount.toFixed(2)}</span>
                    </div>
                    {selectedOrder.balanceAmount > 0 && (
                      <div className="flex justify-between text-amber-400 font-semibold">
                        <span>Balance due</span>
                        <span className="font-mono">₹{selectedOrder.balanceAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Payments */}
                  {selectedOrder.payments?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Payments</h4>
                      {selectedOrder.payments.map((pay: any) => (
                        <div key={pay.id} className="flex justify-between text-neutral-300">
                          <span>{pay.paymentMethod}{pay.transactionRef && <span className="text-neutral-500 font-mono"> · {pay.transactionRef}</span>}</span>
                          <span className="font-mono">₹{pay.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Returns */}
                  {selectedOrder.salesReturns?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Returns</h4>
                      {selectedOrder.salesReturns.map((r: any) => (
                        <div key={r.id} className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-3">
                          <div className="flex justify-between">
                            <span className="font-mono text-white">{r.returnNumber}</span>
                            <span className="font-mono text-amber-400">−₹{r.netAmount.toFixed(2)}</span>
                          </div>
                          <p className="text-neutral-500 mt-1">{new Date(r.createdAt).toLocaleString()}{r.reason && ` · ${r.reason}`}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Approvals */}
                  {selectedOrder.approvals?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Approval</h4>
                      {selectedOrder.approvals.map((a: any) => (
                        <div key={a.id} className="bg-neutral-950/60 border border-neutral-850 rounded-lg p-3 space-y-1">
                          <p className="text-neutral-300">{a.description}</p>
                          <p className="text-neutral-500">
                            {a.status} · requested by {a.requester?.fullName}
                            {a.approver && ` · decided by ${a.approver.fullName}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {!selectedOrder.isQuote && selectedOrder.status === 'FINALIZED' && (
                  <div className="p-6 border-t border-neutral-800">
                    <button
                      onClick={() => startReturnFromOrder(selectedOrder.billNumber)}
                      className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Return items from this bill
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
