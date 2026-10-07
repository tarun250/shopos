'use client';

import React, { useState } from 'react';
import { CheckCircle, PlusCircle, RefreshCw, Search, ShoppingCart, TrendingDown } from 'lucide-react';
import TabPane from './TabPane';
import AddCustomerModal, { AddCustomerForm } from '../modals/AddCustomerModal';
import QuickProductModal, { QuickProductForm } from '../modals/QuickProductModal';
import { useShop } from '../../ShopContext';
import type { CartItem, CartTotals, Category, Customer, PaymentMethod, Product, Unit } from '../../types';

// Default fallback is Level 2 Price under the new pricing model
const getProductPrice = (product: Product, level: string): number => {
  return product.level2Price;
};

// Cart, customer, search and payment state live in page.tsx because keyboard shortcuts
// (F2, F4, Ctrl+F, Ctrl+Space, Escape) and the AI agent drive them too.
interface PosTabProps {
  cart: CartItem[];
  totals: CartTotals;
  setProducts: (products: Product[]) => void;
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
  categories: Category[];
  units: Unit[];
  activeSession: any | null;
  setShowOpeningModal: (show: boolean) => void;
  setShowExpenseModal: (show: boolean) => void;
  setShowClosingModal: (show: boolean) => void;
  productSearchRef: React.RefObject<HTMLInputElement | null>;
  productSearch: string;
  setProductSearch: (value: string) => void;
  filteredProducts: Product[];
  customerSearchRef: React.RefObject<HTMLInputElement | null>;
  customerSearch: string;
  setCustomerSearch: (value: string) => void;
  filteredCustomers: Customer[];
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;
  handleSelectCustomer: (customer: Customer) => void;
  isQuote: boolean;
  setIsQuote: React.Dispatch<React.SetStateAction<boolean>>;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  paidAmount: string;
  setPaidAmount: (value: string) => void;
  isCheckingOut: boolean;
  addToCart: (product: Product) => void;
  updateCartQty: (index: number, qty: number) => void;
  updateCartSellingPrice: (index: number, sellingPrice: number) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  handlePOSCheckout: () => void;
}

export default function PosTab({
  cart,
  totals,
  setProducts,
  customers,
  setCustomers,
  categories,
  units,
  activeSession,
  setShowOpeningModal,
  setShowExpenseModal,
  setShowClosingModal,
  productSearchRef,
  productSearch,
  setProductSearch,
  filteredProducts,
  customerSearchRef,
  customerSearch,
  setCustomerSearch,
  filteredCustomers,
  selectedCustomer,
  setSelectedCustomer,
  handleSelectCustomer,
  isQuote,
  setIsQuote,
  paymentMethod,
  setPaymentMethod,
  paidAmount,
  setPaidAmount,
  isCheckingOut,
  addToCart,
  updateCartQty,
  updateCartSellingPrice,
  removeFromCart,
  clearCart,
  handlePOSCheckout,
}: PosTabProps) {
  const { user } = useShop();

  // Customer Add dialog state
  const [addCustomer, setAddCustomer] = useState<AddCustomerForm>({
    show: false,
    name: '',
    phone: '',
    priceLevel: 'RETAIL',
    creditLimit: '10000',
  });

  // Quick Product popup state
  const [quickProduct, setQuickProduct] = useState<QuickProductForm>({
    show: false,
    name: '',
    categoryId: '',
    costPrice: '',
    sellingPrice: '',
    baseUnitId: '',
  });

  return (
    <TabPane className="flex-1 flex overflow-hidden h-full">
      {/* Left Column: Cart Grid & Invoice Panel */}
      <div className="flex-1 flex flex-col min-w-0 h-full border-r border-neutral-800/80">
        
        {/* Day Session Indicator Banner */}
        {!activeSession ? (
          <div className="bg-amber-600/10 border-b border-amber-500/25 p-3 flex justify-between items-center text-xs shrink-0 text-amber-400">
            <span>⚠️ Day Session is currently closed. Register opening cash to start billing.</span>
            <button 
              type="button"
              onClick={() => setShowOpeningModal(true)}
              className="bg-amber-600 hover:bg-amber-550 text-white font-semibold px-2.5 py-1 rounded transition-colors cursor-pointer"
            >
              Open Day Session
            </button>
          </div>
        ) : (
          <div className="bg-neutral-900/40 border-b border-neutral-800 p-2.5 flex justify-between items-center text-[10px] text-neutral-400 shrink-0 font-mono">
            <div>
              <span>Shift: <span className="text-white font-semibold">{activeSession.openingUser}</span> • Active since {new Date(activeSession.openingTime).toLocaleTimeString()}</span>
            </div>
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => setShowExpenseModal(true)}
                className="bg-neutral-850 hover:bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded border border-neutral-800 transition-colors cursor-pointer"
              >
                Log Expense
              </button>
              <button 
                type="button"
                onClick={() => setShowClosingModal(true)}
                className="bg-red-950/40 hover:bg-red-900/40 text-red-400 px-2 py-0.5 rounded border border-red-900/30 transition-colors cursor-pointer font-semibold"
              >
                Close Day Shift
              </button>
            </div>
          </div>
        )}

        {/* Product Search Bar */}
        <div className="p-4 border-b border-neutral-800 flex items-center gap-3 relative shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 text-neutral-500 w-4.5 h-4.5" />
            <input 
              ref={productSearchRef}
              type="text"
              placeholder="Scan barcode, enter SKU, product name, or alias (Ctrl + Space)..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors font-mono"
            />

            {/* Search Results Dropdown */}
            {filteredProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-40 overflow-hidden py-1">
                {filteredProducts.map((p, idx) => (
                  <div 
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="flex items-center justify-between px-4 py-2 hover:bg-neutral-800/60 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{p.name}</p>
                      <p className="text-xs text-neutral-400 font-mono">{p.sku} • Rack: {p.rackLocation || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">₹{getProductPrice(p, selectedCustomer?.priceLevel || 'RETAIL')}</p>
                      <span className="text-[10px] text-neutral-500">Qty: {p.stockLevels?.[0]?.quantity ?? 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {productSearch && filteredProducts.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-40 overflow-hidden py-4 text-center space-y-2">
                <p className="text-xs text-neutral-400">No products match "{productSearch}"</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuickProduct({
                      show: true,
                      name: productSearch,
                      categoryId: categories[0]?.id || '',
                      costPrice: '',
                      sellingPrice: '',
                      baseUnitId: units[0]?.id || '',
                    });
                    setProductSearch('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-750 text-white transition-colors cursor-pointer"
                >
                  + Quick Create Product
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsQuote(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                isQuote 
                  ? 'bg-amber-600/20 text-amber-400 border-amber-500/50' 
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
              }`}
            >
              {isQuote ? 'Quote Mode Active' : 'Quote Mode (F4)'}
            </button>
            <button 
              onClick={clearCart}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-800 transition-colors cursor-pointer"
            >
              Clear Cart
            </button>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
              <div className="w-16 h-16 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-center justify-center text-neutral-500 mb-4">
                <ShoppingCart className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-semibold text-white">Cart is empty</h3>
              <p className="text-xs text-neutral-500 max-w-[240px] mt-1">Scan a barcode or type a product name to begin checkout flow.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  <th className="py-2.5">Product & SKU</th>
                  <th className="py-2.5 text-right w-24">Default Price</th>
                  <th className="py-2.5 text-center w-28">Quantity</th>
                  <th className="py-2.5 text-right w-24 text-blue-400">Selling Price</th>
                  <th className="py-2.5 text-right w-24">GST</th>
                  <th className="py-2.5 text-right w-28">Total</th>
                  <th className="py-2.5 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {cart.map((item, idx) => {
                  const sellPrice = item.unitPrice - item.discount;
                  const isElevated = user?.role === 'OWNER' || user?.role === 'MANAGER';
                  const profit = sellPrice - (item.product.stockLevels?.[0]?.costPrice || 0);
                  const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;
                  const isMarginWarning = margin < item.product.minimumProfitPct;

                  return (
                    <tr key={idx} className="group hover:bg-neutral-900/30 transition-colors">
                      <td className="py-3 pr-2">
                        <p className="text-xs font-semibold text-white leading-snug">{item.product.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-neutral-500 font-mono">{item.product.sku}</span>
                          {isElevated && isMarginWarning && (
                            <span className="text-[8px] bg-red-950 text-red-400 border border-red-900/40 px-1 rounded flex items-center gap-0.5">
                              <TrendingDown className="w-2.5 h-2.5" /> Margin: {margin.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-xs text-neutral-400">
                        ₹{item.product.level2Price.toFixed(2)}
                      </td>
                      <td className="py-3 text-center">
                        <div className="inline-flex items-center bg-neutral-900 border border-neutral-800 rounded-md">
                          <button 
                            onClick={() => updateCartQty(idx, item.quantity - 1)}
                            className="px-2 py-0.5 text-xs text-neutral-500 hover:text-white"
                          >
                            -
                          </button>
                          <input 
                            type="number"
                            value={item.quantity}
                            onChange={e => updateCartQty(idx, Number(e.target.value))}
                            className="w-10 bg-transparent text-center text-xs font-mono text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button 
                            onClick={() => updateCartQty(idx, item.quantity + 1)}
                            className="px-2 py-0.5 text-xs text-neutral-500 hover:text-white"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-3 pr-2">
                        <input 
                          type="number"
                          value={Number(sellPrice.toFixed(2)) || ''}
                          placeholder="0.00"
                          onChange={e => updateCartSellingPrice(idx, Number(e.target.value))}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-1.5 py-0.5 text-right text-xs font-mono text-white focus:outline-none"
                        />
                      </td>
                      <td className="py-3 text-right font-mono text-[10px] text-neutral-400 leading-none">
                        <div>C: {item.cgstRate}%</div>
                        <div className="mt-1">S: {item.sgstRate}%</div>
                      </td>
                      <td className="py-3 text-right font-semibold font-mono text-xs text-white">
                        ₹{item.totalPrice.toFixed(2)}
                      </td>
                      <td className="py-3 text-center">
                        <button 
                          onClick={() => removeFromCart(idx)}
                          className="text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Cart Calculations Summary Footer */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-neutral-800 bg-neutral-900/20 shrink-0 space-y-4">
            <div className="grid grid-cols-4 gap-4 text-right">
              <div>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Taxable Amt</span>
                <span className="text-sm font-semibold font-mono text-neutral-200">₹{totals.subtotal.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Total CGST</span>
                <span className="text-sm font-semibold font-mono text-neutral-200">₹{totals.cgst.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Total SGST</span>
                <span className="text-sm font-semibold font-mono text-neutral-200">₹{totals.sgst.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Final Bill Total</span>
                <span className="text-base font-bold font-mono text-violet-400">₹{totals.netAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Customer Details & Checkout Splits */}
      <div className="w-80 flex flex-col h-full bg-neutral-900/10 p-5 shrink-0">
        <div className="flex-1 space-y-6">
          
          {/* Section A: Customer Account Link */}
          <div>
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Customer Account</h3>
            
            {!selectedCustomer ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 text-neutral-500 w-3.5 h-3.5" />
                  <input 
                    ref={customerSearchRef}
                    type="text"
                    placeholder="Search customer by mobile..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                  />

                  {/* Customer Search results */}
                  {filteredCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-50 overflow-hidden">
                      {filteredCustomers.map(c => (
                        <div 
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          className="px-3 py-2 hover:bg-neutral-800 cursor-pointer flex justify-between items-center text-xs"
                        >
                          <div>
                            <p className="font-semibold text-white">{c.name}</p>
                            <p className="text-neutral-400">{c.phone}</p>
                          </div>
                          <span className="bg-neutral-800 text-[10px] px-1.5 py-0.5 rounded text-neutral-300">{c.priceLevel}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setAddCustomer(prev => ({ ...prev, show: true }))}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Register New Customer</span>
                </button>
              </div>
            ) : (
              <div className="bg-neutral-900 border border-neutral-800/80 p-3.5 rounded-xl space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-white">{selectedCustomer.name}</p>
                    <p className="text-[10px] text-neutral-500">{selectedCustomer.phone}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedCustomer(null)}
                    className="text-[10px] text-neutral-400 hover:text-red-400 cursor-pointer"
                  >
                    Change
                  </button>
                </div>
                <div className="h-px bg-neutral-800/80 my-2" />
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-400">Pricing Tier:</span>
                  <span className="font-semibold text-violet-400 uppercase tracking-wider">{selectedCustomer.priceLevel}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-400">Ledger Balance:</span>
                  <span className={`font-semibold ${selectedCustomer.balance > 0 ? 'text-amber-400' : 'text-neutral-400'}`}>
                    ₹{selectedCustomer.balance.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section C: Payment Method Selector */}
          <div>
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Payment Method</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['CASH', 'UPI', 'CARD', 'CREDIT'] as const).map(method => {
                const isDisabled = method === 'CREDIT' && !selectedCustomer;
                return (
                  <button 
                    key={method}
                    disabled={isDisabled}
                    onClick={() => setPaymentMethod(method)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors border text-center ${
                      isDisabled 
                        ? 'opacity-30 border-neutral-800 text-neutral-500 cursor-not-allowed'
                        : paymentMethod === method 
                          ? 'bg-violet-600 border-violet-500 text-white' 
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    {method}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section D: Cash Change Calculation */}
          {paymentMethod === 'CASH' && (
            <div className="space-y-3 bg-neutral-950/40 border border-neutral-850 p-4 rounded-xl">
              <div>
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Customer Cash Handed Over</h3>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-neutral-500 text-xs font-mono">₹</span>
                  <input 
                    type="number"
                    value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-6 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500"
                    placeholder="0.00"
                  />
                </div>
                {/* Tender quick match suggestions */}
                {cart.length > 0 && (
                  <div className="flex gap-1.5 mt-2">
                    <button 
                      onClick={() => setPaidAmount(totals.netAmount.toFixed(0))}
                      className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800/80 text-[10px] text-neutral-300 px-2 py-1 rounded transition-colors cursor-pointer"
                    >
                      Exact Cash
                    </button>
                    <button 
                      onClick={() => setPaidAmount((Math.ceil(totals.netAmount / 100) * 100).toString())}
                      className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800/80 text-[10px] text-neutral-300 px-2 py-1 rounded transition-colors cursor-pointer"
                    >
                      Next ₹100
                    </button>
                  </div>
                )}
              </div>

              {/* Display Change to Return */}
              <div className="flex justify-between items-center pt-2 border-t border-neutral-805 text-xs">
                <span className="text-neutral-400">Amount to Return:</span>
                <span className="font-mono font-bold text-green-400 text-sm">
                  ₹{Math.max(0, Number(paidAmount) - totals.netAmount).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Checkout Trigger */}
        {(() => {
          const cashValue = Number(paidAmount);
          const isCash = paymentMethod === 'CASH';
          const isInsufficient = isCash && (isNaN(cashValue) || cashValue < totals.netAmount);
          const isEmptyCash = isCash && (!paidAmount || cashValue === 0);
          
          let buttonText = isQuote ? 'Save Quotation' : 'Complete Payment (F2)';
          let isBtnDisabled = cart.length === 0 || isCheckingOut;

          if (isCash && !isQuote) {
            if (isEmptyCash) {
              buttonText = 'Enter Cash Given';
              isBtnDisabled = true;
            } else if (isInsufficient) {
              buttonText = `Insufficient Cash (Need ₹${(totals.netAmount - cashValue).toFixed(2)} more)`;
              isBtnDisabled = true;
            }
          }

          return (
            <button 
              onClick={handlePOSCheckout}
              disabled={isBtnDisabled}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold py-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 mt-4 shadow-lg shadow-violet-600/10"
            >
              {isCheckingOut ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              <span>{buttonText}</span>
            </button>
          );
        })()}
      </div>

      {/* OVERLAY D: Add Customer Dialog */}
      <AddCustomerModal
        addCustomer={addCustomer}
        setAddCustomer={setAddCustomer}
        customers={customers}
        setCustomers={setCustomers}
        handleSelectCustomer={handleSelectCustomer}
      />

      {/* OVERLAY F: Quick Product Creation during POS checkout */}
      <QuickProductModal
        quickProduct={quickProduct}
        setQuickProduct={setQuickProduct}
        categories={categories}
        units={units}
        setProducts={setProducts}
        addToCart={addToCart}
      />
    </TabPane>
  );
}
