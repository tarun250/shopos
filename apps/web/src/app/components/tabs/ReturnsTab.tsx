'use client';

import React, { useEffect, useState } from 'react';
import { Undo } from 'lucide-react';
import TabPane from './TabPane';
import { useShop } from '../../ShopContext';

interface ReturnsTabProps {
  // Bill number handed over by "Return items from this bill" in Order History; looked up on arrival
  returnBillNumber: string | null;
  onReturnBillHandled: () => void;
}

export default function ReturnsTab({ returnBillNumber, onReturnBillHandled }: ReturnsTabProps) {
  const { API_BASE, secureFetch, user, isSandboxMode, fetchAllData } = useShop();

  const [returnsList, setReturnsList] = useState<{ salesReturns: any[]; purchaseReturns: any[] }>({ salesReturns: [], purchaseReturns: [] });
  const [returnsLoading, setReturnsLoading] = useState(!isSandboxMode);

  // Sales Return Wizard States
  const [salesReturnSearchBill, setSalesReturnSearchBill] = useState('');
  const [salesReturnBillDetails, setSalesReturnBillDetails] = useState<any | null>(null);
  const [salesReturnQty, setSalesReturnQty] = useState<Record<string, number>>({});
  const [salesReturnDisp, setSalesReturnDisp] = useState<Record<string, string>>({});
  const [salesReturnNotes, setSalesReturnNotes] = useState<Record<string, string>>({});
  const [salesReturnReason, setSalesReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const fetchReturnsData = async () => {
    if (isSandboxMode) return;
    setReturnsLoading(true);
    try {
      const res = await secureFetch(`${API_BASE}/billing/returns`);
      if (res.ok) {
        const data = await res.json();
        setReturnsList(data);
      }
    } catch (err) {
      console.error('Error fetching returns:', err);
    } finally {
      setReturnsLoading(false);
    }
  };

  const handleFetchBillForReturn = async (billNumberArg?: unknown) => {
    const billNumber = (typeof billNumberArg === 'string' ? billNumberArg : salesReturnSearchBill).trim();
    if (!billNumber) return;
    try {
      const res = await secureFetch(`${API_BASE}/billing/bills/${encodeURIComponent(billNumber)}`);
      if (res.status === 404) {
        alert('Bill not found.');
        return;
      }
      if (res.ok) {
        const bill = await res.json();
        if (bill.isQuote || bill.status !== 'FINALIZED') {
          alert('Only finalized bills can be returned. This bill is a quote, pending approval, or rejected.');
        } else {
          setSalesReturnBillDetails(bill);
          const qMap: Record<string, number> = {};
          const dMap: Record<string, string> = {};
          const nMap: Record<string, string> = {};
          bill.items.forEach((item: any) => {
            qMap[item.productId] = 0;
            dMap[item.productId] = 'RETURN_TO_STOCK';
            nMap[item.productId] = '';
          });
          setSalesReturnQty(qMap);
          setSalesReturnDisp(dMap);
          setSalesReturnNotes(nMap);
        }
      }
    } catch (err) {
      alert('Error searching for bill details.');
    }
  };

  const handleSubmitSalesReturn = async () => {
    if (!salesReturnBillDetails) return;

    const returnItems = Object.entries(salesReturnQty)
      .filter(([_, qty]) => qty > 0)
      .map(([prodId, qty]) => {
        const originalItem = salesReturnBillDetails.items.find((i: any) => i.productId === prodId);
        return {
          productId: prodId,
          quantity: Number(qty),
          unitPrice: originalItem?.unitPrice || 0,
          disposition: salesReturnDisp[prodId] || 'RETURN_TO_STOCK',
          notes: salesReturnNotes[prodId] || ''
        };
      });

    if (returnItems.length === 0) {
      alert('Please enter a quantity greater than 0 for at least one item.');
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const res = await secureFetch(`${API_BASE}/billing/returns/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId: salesReturnBillDetails.id,
          reason: salesReturnReason,
          userId: user?.userId || 'SYSTEM',
          items: returnItems
        })
      });

      if (res.ok) {
        alert('Return processed successfully!');
        setSalesReturnBillDetails(null);
        setSalesReturnSearchBill('');
        setSalesReturnQty({});
        setSalesReturnReason('');
        fetchReturnsData();
        fetchAllData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to process return.');
      }
    } catch (err) {
      alert('Network error while processing return.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  useEffect(() => {
    fetchReturnsData();
  }, []);

  useEffect(() => {
    if (!returnBillNumber) return;
    setSalesReturnSearchBill(returnBillNumber);
    handleFetchBillForReturn(returnBillNumber);
    onReturnBillHandled();
  }, [returnBillNumber]);

  return (
    <TabPane className="flex-1 flex p-6 gap-6 overflow-hidden h-full">
      {/* Return Wizard (Left) */}
      <div className="w-[450px] bg-neutral-900/60 border border-neutral-850 rounded-2xl p-6 flex flex-col overflow-hidden shrink-0">
        <h3 className="text-sm font-bold text-white mb-4">Process New Return</h3>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Enter Invoice Bill Number..."
            value={salesReturnSearchBill}
            onChange={e => setSalesReturnSearchBill(e.target.value)}
            className="flex-1 bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={handleFetchBillForReturn}
            className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
          >
            Lookup
          </button>
        </div>

        {salesReturnBillDetails ? (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-850 text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-500">Bill Date:</span>
                <span className="text-white">{new Date(salesReturnBillDetails.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Net Total:</span>
                <span className="text-white">₹{salesReturnBillDetails.netAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {salesReturnBillDetails.items.map((item: any) => (
                <div key={item.productId} className="bg-neutral-950/30 border border-neutral-850 p-3 rounded-xl space-y-2">
                  <div className="text-xs font-semibold text-white">{item.product?.name}</div>
                  <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                    <span>Sold Qty: {item.quantity}</span>
                    <span>Rate: ₹{item.unitPrice.toFixed(2)}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 pt-1.5">
                    <div>
                      <label className="text-[9px] text-neutral-500 block mb-1">Return Qty</label>
                      <input
                        type="number"
                        min={0}
                        max={item.quantity}
                        value={salesReturnQty[item.productId] || 0}
                        onChange={e => {
                          const val = Math.min(item.quantity, Math.max(0, Number(e.target.value)));
                          setSalesReturnQty({ ...salesReturnQty, [item.productId]: val });
                        }}
                        className="w-full bg-neutral-950 border border-neutral-850 rounded px-2 py-1 text-xs font-mono text-white text-center focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-neutral-500 block mb-1">Disposition</label>
                      <select
                        value={salesReturnDisp[item.productId] || 'RETURN_TO_STOCK'}
                        onChange={e => setSalesReturnDisp({ ...salesReturnDisp, [item.productId]: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-850 rounded px-1.5 py-1 text-xs text-neutral-300 focus:outline-none"
                      >
                        <option value="RETURN_TO_STOCK">Restock Item</option>
                        <option value="DAMAGED">Damaged / Scrap</option>
                        <option value="WARRANTY">Warranty Claim</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-2 border-t border-neutral-850">
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Return Reason / Notes</label>
                <input
                  type="text"
                  placeholder="Reason for return..."
                  value={salesReturnReason}
                  onChange={e => setSalesReturnReason(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <button
                onClick={handleSubmitSalesReturn}
                disabled={isSubmittingReturn}
                className="w-full bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold py-2.5 rounded-xl cursor-pointer transition-colors text-xs flex items-center justify-center gap-2"
              >
                {isSubmittingReturn ? 'Processing...' : 'Authorize Return'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-neutral-850 rounded-xl p-4 text-center text-xs text-neutral-500">
            <Undo className="w-8 h-8 mb-2 text-neutral-600" />
            Look up a finalized bill invoice number to initiate customer return itemizations.
          </div>
        )}
      </div>

      {/* Returns History Logs (Right) */}
      <div className="flex-1 bg-neutral-900/60 border border-neutral-850 rounded-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-neutral-850">
          <h3 className="text-sm font-bold text-white">Return Ledger Logs</h3>
        </div>

        <div className="overflow-y-auto flex-1">
          {returnsLoading ? (
            <div className="p-8 text-center text-xs text-neutral-500 animate-pulse">Loading return timelines...</div>
          ) : returnsList.salesReturns.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">No returns history found.</div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-850 bg-neutral-950/40 text-neutral-400 font-semibold">
                  <th className="p-4">Return ID</th>
                  <th className="p-4">Bill Ref</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4 text-right">Refund Total</th>
                  <th className="p-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850 text-neutral-300">
                {returnsList.salesReturns.map((r: any) => (
                  <tr key={r.id} className="hover:bg-neutral-850/30 transition-colors">
                    <td className="p-4 font-mono font-medium text-white">{r.returnNumber}</td>
                    <td className="p-4 font-mono text-neutral-400">{r.bill?.billNumber}</td>
                    <td className="p-4 text-neutral-400 max-w-[150px] truncate">{r.reason || 'N/A'}</td>
                    <td className="p-4 text-right font-mono font-bold text-green-400">₹{r.netAmount.toFixed(2)}</td>
                    <td className="p-4 text-neutral-400">{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </TabPane>
  );
}
