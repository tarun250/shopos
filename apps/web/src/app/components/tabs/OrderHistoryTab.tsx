'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import TabPane from './TabPane';
import OrderDetailDrawer from '../modals/OrderDetailDrawer';
import { useShop } from '../../ShopContext';

const ORDERS_PAGE_SIZE = 25;

// The open bill lives in page.tsx so the AI agent can open a bill from any screen.
interface OrderHistoryTabProps {
  selectedOrder: any | null;
  setSelectedOrder: (order: any | null) => void;
  orderDetailLoading: boolean;
  setOrderDetailLoading: (loading: boolean) => void;
  openOrderDetail: (idOrNumber: string) => void;
  startReturnFromOrder: (billNumber: string) => void;
}

export default function OrderHistoryTab({
  selectedOrder,
  setSelectedOrder,
  orderDetailLoading,
  setOrderDetailLoading,
  openOrderDetail,
  startReturnFromOrder,
}: OrderHistoryTabProps) {
  const { API_BASE, secureFetch, isSandboxMode } = useShop();

  const [orders, setOrders] = useState<any[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersSummary, setOrdersSummary] = useState<{ count: number; netTotal: number; paidTotal: number; balanceTotal: number } | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderFilters, setOrderFilters] = useState({ search: '', period: '30d', status: '', paymentMethod: '' });
  const [ordersPage, setOrdersPage] = useState(1);

  const fetchOrders = async () => {
    if (isSandboxMode) return;
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(ordersPage), take: String(ORDERS_PAGE_SIZE) });
      if (orderFilters.search.trim()) params.set('search', orderFilters.search.trim());
      if (orderFilters.status) params.set('status', orderFilters.status);
      if (orderFilters.paymentMethod) params.set('paymentMethod', orderFilters.paymentMethod);
      const daysBack = ({ today: 0, '7d': 6, '30d': 29 } as Record<string, number>)[orderFilters.period];
      if (daysBack !== undefined) {
        const from = new Date();
        from.setHours(0, 0, 0, 0);
        from.setDate(from.getDate() - daysBack);
        params.set('from', from.toISOString());
      }
      const res = await secureFetch(`${API_BASE}/billing/bills?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.items);
        setOrdersTotal(data.total);
        setOrdersSummary(data.summary);
      }
    } catch (err) {
      console.error('Error fetching order history:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const updateOrderFilters = (patch: Partial<typeof orderFilters>) => {
    setOrderFilters(prev => ({ ...prev, ...patch }));
    setOrdersPage(1);
  };

  useEffect(() => {
    // Debounce typing in the search box
    const timer = setTimeout(fetchOrders, orderFilters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [orderFilters, ordersPage]);

  return (
    <TabPane className="flex-1 flex flex-col p-6 overflow-hidden h-full space-y-5">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Order History</h2>
          <p className="text-xs text-neutral-400 mt-1">Every bill and quote, with payment, tax and return details.</p>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search bill number, customer name or phone"
            value={orderFilters.search}
            onChange={e => updateOrderFilters({ search: e.target.value })}
            className="w-full bg-neutral-950 border border-neutral-850 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {([['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['all', 'All time']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => updateOrderFilters({ period: value })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                orderFilters.period === value ? 'bg-white text-neutral-950' : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={orderFilters.status}
          onChange={e => updateOrderFilters({ status: e.target.value })}
          className="bg-neutral-950 border border-neutral-850 rounded-lg px-2 py-2 text-xs text-neutral-300 focus:outline-none"
        >
          <option value="">All bills</option>
          <option value="FINALIZED">Finalized</option>
          <option value="PENDING_APPROVAL">Pending approval</option>
          <option value="REJECTED">Rejected</option>
          <option value="QUOTE">Quotes</option>
        </select>
        <select
          value={orderFilters.paymentMethod}
          onChange={e => updateOrderFilters({ paymentMethod: e.target.value })}
          className="bg-neutral-950 border border-neutral-850 rounded-lg px-2 py-2 text-xs text-neutral-300 focus:outline-none"
        >
          <option value="">All payments</option>
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
          <option value="CARD">Card</option>
          <option value="CREDIT">Credit</option>
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: orderFilters.status === 'QUOTE' ? 'Quotes' : 'Finalized orders', value: String(ordersSummary?.count ?? 0) },
          { label: 'Sales value', value: `₹${(ordersSummary?.netTotal ?? 0).toFixed(2)}` },
          { label: 'Collected', value: `₹${(ordersSummary?.paidTotal ?? 0).toFixed(2)}` },
          { label: 'On credit', value: `₹${(ordersSummary?.balanceTotal ?? 0).toFixed(2)}` },
        ].map(card => (
          <div key={card.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">{card.label}</span>
            <p className="text-lg font-bold text-white font-mono mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div className="flex-1 overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-xl">
        {!ordersLoading && orders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-neutral-500">
              {isSandboxMode ? 'Order history needs the backend; it is not available in sandbox mode.' : 'No orders match these filters.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-neutral-900 z-10">
              <tr className="border-b border-neutral-800 text-neutral-500">
                <th className="p-3 font-semibold">Bill</th>
                <th className="p-3 font-semibold">Date</th>
                <th className="p-3 font-semibold">Customer</th>
                <th className="p-3 font-semibold text-center">Items</th>
                <th className="p-3 font-semibold">Payment</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-850 text-neutral-300">
              {orders.map((o: any) => {
                const statusLabel = o.isQuote ? 'QUOTE' : o.status;
                const statusClass = o.isQuote
                  ? 'bg-blue-950 text-blue-400 border-blue-900/40'
                  : o.status === 'FINALIZED'
                    ? 'bg-green-950 text-green-400 border-green-900/40'
                    : o.status === 'PENDING_APPROVAL'
                      ? 'bg-amber-950 text-amber-400 border-amber-900/40'
                      : 'bg-red-950 text-red-400 border-red-900/40';
                return (
                  <tr
                    key={o.id}
                    onClick={() => openOrderDetail(o.id)}
                    className="hover:bg-neutral-850/30 transition-colors cursor-pointer"
                  >
                    <td className="p-3 font-mono font-medium text-white">
                      {o.billNumber}
                      {o._count?.salesReturns > 0 && (
                        <span className="ml-2 text-[9px] font-sans font-bold uppercase text-amber-400">Returned</span>
                      )}
                    </td>
                    <td className="p-3 text-neutral-400 whitespace-nowrap">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className="p-3">
                      <div className="text-white">{o.customer?.name || 'Walk-in'}</div>
                      {o.customer?.phone && o.customer.phone !== '0000000000' && (
                        <div className="text-[10px] text-neutral-500 font-mono">{o.customer.phone}</div>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono">{o._count?.items ?? 0}</td>
                    <td className="p-3">{o.paymentMethod}</td>
                    <td className="p-3">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${statusClass}`}>
                        {statusLabel.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">
                      <div className="font-bold text-white">₹{o.netAmount.toFixed(2)}</div>
                      {o.balanceAmount > 0 && !o.isQuote && (
                        <div className="text-[10px] text-amber-400">Due ₹{o.balanceAmount.toFixed(2)}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination (right padding keeps it clear of the floating copilot button) */}
      <div className="flex justify-between items-center text-xs text-neutral-500 pr-16">
        <span>
          {ordersTotal === 0
            ? 'No orders'
            : `Showing ${(ordersPage - 1) * ORDERS_PAGE_SIZE + 1}–${Math.min(ordersPage * ORDERS_PAGE_SIZE, ordersTotal)} of ${ordersTotal}`}
        </span>
        <div className="flex gap-2">
          <button
            disabled={ordersPage === 1}
            onClick={() => setOrdersPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            disabled={ordersPage * ORDERS_PAGE_SIZE >= ordersTotal}
            onClick={() => setOrdersPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      {/* Order detail drawer */}
      <OrderDetailDrawer
        selectedOrder={selectedOrder}
        setSelectedOrder={setSelectedOrder}
        orderDetailLoading={orderDetailLoading}
        setOrderDetailLoading={setOrderDetailLoading}
        startReturnFromOrder={startReturnFromOrder}
      />
    </TabPane>
  );
}
