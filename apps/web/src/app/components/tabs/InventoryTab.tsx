'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import TabPane from './TabPane';
import { EditProductModal, RecycleBinModal, StockAdjustmentModal } from '../modals/InventoryModals';
import ProductWizardModal from '../modals/ProductWizardModal';
import { useShop } from '../../ShopContext';
import type { Category, Product, Supplier, Unit } from '../../types';

// The catalogue page (products + cursor pagination) lives in page.tsx: POS search and the AI agent use it too.
interface InventoryTabProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
  categories: Category[];
  units: Unit[];
  suppliers: Supplier[];
  catalogSearch: string;
  handleCatalogSearchChange: (value: string) => void;
  catalogCursorHistory: string[];
  hasMoreCatalog: boolean;
  handleCatalogPrevPage: () => void;
  handleCatalogNextPage: () => void;
}

export default function InventoryTab({
  products,
  setProducts,
  categories,
  units,
  suppliers,
  catalogSearch,
  handleCatalogSearchChange,
  catalogCursorHistory,
  hasMoreCatalog,
  handleCatalogPrevPage,
  handleCatalogNextPage,
}: InventoryTabProps) {
  const { API_BASE, secureFetch, user, fetchAllData } = useShop();

  // Stock Adjustment modal state
  const [stockAdjustment, setStockAdjustment] = useState<{
    show: boolean;
    product: Product | null;
    quantityChanged: string;
    reason: string;
    type: 'ADJUSTMENT' | 'RECONCILIATION';
  }>({ show: false, product: null, quantityChanged: '', reason: '', type: 'ADJUSTMENT' });

  // Product Edit dialog state
  const [editProduct, setEditProduct] = useState<{
    show: boolean;
    product: Product | null;
    name: string;
    sku: string;
    barcode: string;
    rackLocation: string;
    hsnCode: string;
    cgstRate: string;
    sgstRate: string;
    costPrice: string;
    minimumProfitPct: string;
    mrp: string;
    level1Price: string;
    level2Price: string;
    level3Price: string;
    emergencyPrice: string;
    retailPrice: string;
    wholesalePrice: string;
  }>({
    show: false,
    product: null,
    name: '',
    sku: '',
    barcode: '',
    rackLocation: '',
    hsnCode: '',
    cgstRate: '0',
    sgstRate: '0',
    costPrice: '0',
    minimumProfitPct: '10',
    mrp: '',
    level1Price: '0',
    level2Price: '0',
    level3Price: '0',
    emergencyPrice: '0',
    retailPrice: '0',
    wholesalePrice: '0',
  });

  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  const triggerEditProduct = (p: Product) => {
    const retail = p.priceLevels.find(pl => pl.level === 'RETAIL')?.price || 0;
    const wholesale = p.priceLevels.find(pl => pl.level === 'WHOLESALE')?.price || 0;
    const cost = p.stockLevels?.[0]?.costPrice || 0;

    setEditProduct({
      show: true,
      product: p,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || '',
      rackLocation: p.rackLocation || '',
      hsnCode: p.hsnCode || '',
      cgstRate: p.cgstRate.toString(),
      sgstRate: p.sgstRate.toString(),
      costPrice: cost.toString(),
      minimumProfitPct: p.minimumProfitPct.toString(),
      mrp: p.mrp != null ? p.mrp.toString() : '',
      level1Price: String(p.level1Price ?? 0),
      level2Price: String(p.level2Price ?? 0),
      level3Price: String(p.level3Price ?? 0),
      emergencyPrice: String(p.emergencyPrice ?? 0),
      retailPrice: retail.toString(),
      wholesalePrice: wholesale.toString(),
    });
  };

  const deleteProduct = async (pId: string) => {
    if (!confirm('Are you sure you want to soft-delete this product? It will be moved to the Recycle Bin.')) return;
    try {
      const res = await secureFetch(`${API_BASE}/products/${pId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.userId })
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Product moved to Recycle Bin.');
      fetchAllData();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <TabPane className="flex-1 flex flex-col p-6 overflow-hidden h-full">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Products & Stock Ledger</h2>
          <p className="text-xs text-neutral-400 mt-1">Multi-tier prices, shelf locations, and manual inventory adjustments.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowRecycleBin(true)}
            className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-neutral-800 transition-colors cursor-pointer"
          >
            Recycle Bin
          </button>
          {user?.role === 'OWNER' || user?.role === 'MANAGER' ? (
            <button
              type="button"
              onClick={() => setShowCreateWizard(true)}
              className="bg-violet-600 hover:bg-violet-550 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              + Create Product
            </button>
          ) : null}
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 text-neutral-500 w-3.5 h-3.5" />
            <input 
              type="text"
              placeholder="Search SKU or name..."
              value={catalogSearch}
              onChange={e => handleCatalogSearchChange(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Inventory Table Container */}
      <div className="flex-1 bg-neutral-900/35 border border-neutral-800 rounded-xl overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-wider bg-neutral-950/20">
              <th className="p-3">Product Name & SKU</th>
              <th className="p-3 text-center">Base Unit</th>
              {user?.role === 'OWNER' || user?.role === 'MANAGER' ? (
                <th className="p-3 text-right">Cost Price</th>
              ) : null}
              <th className="p-3 text-right">Retail Price</th>
              <th className="p-3 text-right">Wholesale Price</th>
              <th className="p-3 text-center">Rack Location</th>
              <th className="p-3 text-right">Qty in Stock</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900/70 text-xs">
            {products.map(p => {
              const retail = p.priceLevels.find(pl => pl.level === 'RETAIL')?.price || 0;
              const wholesale = p.priceLevels.find(pl => pl.level === 'WHOLESALE')?.price || 0;
              const stock = p.stockLevels?.[0]?.quantity || 0;
              const isLowStock = stock <= (p.stockLevels?.[0]?.minStockLevel || 0);
              const isElevated = user?.role === 'OWNER' || user?.role === 'MANAGER';

              return (
                <tr key={p.id} className="hover:bg-neutral-900/20 transition-colors">
                  <td className="p-3">
                    <p className="font-semibold text-white">{p.name}</p>
                    <span className="text-[10px] text-neutral-500 font-mono block mt-0.5">{p.sku}</span>
                  </td>
                  <td className="p-3 text-center text-neutral-300 font-mono">
                    {p.baseUnit.abbreviation}
                  </td>
                  {isElevated ? (
                    <td className="p-3 text-right font-mono text-neutral-300">
                      ₹{(p.stockLevels?.[0]?.costPrice || 0).toFixed(2)}
                    </td>
                  ) : null}
                  <td className="p-3 text-right font-mono text-white">
                    ₹{retail.toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-mono text-violet-400">
                    ₹{wholesale.toFixed(2)}
                  </td>
                  <td className="p-3 text-center text-neutral-400 font-mono">
                    {p.rackLocation || 'Shelf N/A'}
                  </td>
                  <td className="p-3 text-right">
                    <span className={`font-mono font-bold ${isLowStock ? 'text-red-400' : 'text-green-400'}`}>
                      {stock}
                    </span>
                    {isLowStock && <span className="text-[8px] bg-red-950 text-red-400 px-1 rounded block text-center mt-0.5">Low Stock</span>}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-1.5">
                      <button 
                        onClick={() => setStockAdjustment({
                          show: true,
                          product: p,
                          quantityChanged: '',
                          reason: '',
                          type: 'ADJUSTMENT'
                        })}
                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-[10px] px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                      >
                        Adjust Stock
                      </button>
                      {isElevated && (
                        <>
                          <button 
                            onClick={() => triggerEditProduct(p)}
                            className="bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-500/30 text-[10px] px-2.5 py-1 rounded-md transition-colors cursor-pointer font-semibold"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => deleteProduct(p.id)}
                            className="bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/30 text-[10px] px-2.5 py-1 rounded-md transition-colors cursor-pointer font-semibold"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-4 shrink-0 bg-neutral-950/20 border border-neutral-800 px-4 py-2.5 rounded-xl text-xs">
        <span className="text-neutral-400">
          Page Depth: <span className="text-white font-semibold font-mono">{catalogCursorHistory.length + 1}</span>
        </span>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleCatalogPrevPage}
            disabled={catalogCursorHistory.length === 0}
            className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Previous Page
          </button>
          <button 
            onClick={handleCatalogNextPage}
            disabled={!hasMoreCatalog}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Next Page
          </button>
        </div>
      </div>

      {/* OVERLAY C: Stock Adjustments Popup */}
      <StockAdjustmentModal
        stockAdjustment={stockAdjustment}
        setStockAdjustment={setStockAdjustment}
        products={products}
        setProducts={setProducts}
      />

      {/* OVERLAY E: Edit Product details dialog */}
      <EditProductModal
        editProduct={editProduct}
        setEditProduct={setEditProduct}
        products={products}
        setProducts={setProducts}
      />

      {/* OVERLAY G: Shopify-Style Product Creation Wizard */}
      <ProductWizardModal
        showCreateWizard={showCreateWizard}
        setShowCreateWizard={setShowCreateWizard}
        products={products}
        categories={categories}
        units={units}
        suppliers={suppliers}
      />

      {/* OVERLAY H: Recycle Bin view */}
      <RecycleBinModal showRecycleBin={showRecycleBin} setShowRecycleBin={setShowRecycleBin} products={products} />
    </TabPane>
  );
}
