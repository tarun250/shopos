'use client';

// Dialogs opened from the Products & Stock tab (stock adjustment, product edit, recycle bin)

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShop } from '../../ShopContext';
import type { Product } from '../../types';

export interface StockAdjustmentForm {
  show: boolean;
  product: Product | null;
  quantityChanged: string;
  reason: string;
  type: 'ADJUSTMENT' | 'RECONCILIATION';
}

interface StockAdjustmentModalProps {
  stockAdjustment: StockAdjustmentForm;
  setStockAdjustment: (value: StockAdjustmentForm) => void;
  products: Product[];
  setProducts: (products: Product[]) => void;
}

export function StockAdjustmentModal({ stockAdjustment, setStockAdjustment, products, setProducts }: StockAdjustmentModalProps) {
  const { API_BASE, secureFetch, user, isSandboxMode, fetchAllData } = useShop();

  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockAdjustment.product || !stockAdjustment.quantityChanged) return;

    const qty = Number(stockAdjustment.quantityChanged);
    if (isNaN(qty)) return;

    if (isSandboxMode) {
      // Offline edit
      const updatedProds = products.map(p => {
        if (p.id === stockAdjustment.product?.id) {
          const updatedInv = [...p.stockLevels];
          updatedInv[0].quantity = Math.max(0, updatedInv[0].quantity + qty);
          return { ...p, stockLevels: updatedInv };
        }
        return p;
      });
      setProducts(updatedProds);
      setStockAdjustment({ show: false, product: null, quantityChanged: '', reason: '', type: 'ADJUSTMENT' });
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/products/adjust-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: stockAdjustment.product.id,
          quantityChanged: qty,
          type: stockAdjustment.type,
          costPrice: stockAdjustment.product.stockLevels?.[0]?.costPrice,
          userId: user?.userId,
          reason: stockAdjustment.reason,
        }),
      });

      if (res.ok) {
        setStockAdjustment({ show: false, product: null, quantityChanged: '', reason: '', type: 'ADJUSTMENT' });
        fetchAllData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to adjust stock');
      }
    } catch (e) {
      alert('Network issue adjusting stock');
    }
  };

  return (
    <AnimatePresence>
      {stockAdjustment.show && stockAdjustment.product && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[360px] shadow-2xl relative"
          >
            <h3 className="text-base font-bold text-white mb-1">Adjust Inventory Level</h3>
            <p className="text-xs text-neutral-400 font-mono mb-4">{stockAdjustment.product.name} ({stockAdjustment.product.sku})</p>

            <form onSubmit={handleAdjustStockSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Adjustment Type</label>
                <select 
                  value={stockAdjustment.type}
                  onChange={e => setStockAdjustment({ ...stockAdjustment, type: e.target.value as any })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="ADJUSTMENT">Quantity Correction (Add/Remove)</option>
                  <option value="RECONCILIATION">Reconciliation / Audited quantity</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                  Quantity Difference (e.g. +10 or -5)
                </label>
                <input 
                  type="number"
                  value={stockAdjustment.quantityChanged}
                  placeholder="Enter change value"
                  onChange={e => setStockAdjustment({ ...stockAdjustment, quantityChanged: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Reason / Notes</label>
                <input 
                  type="text"
                  value={stockAdjustment.reason}
                  placeholder="E.g., Damaged item / Physical count variance"
                  onChange={e => setStockAdjustment({ ...stockAdjustment, reason: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setStockAdjustment({ show: false, product: null, quantityChanged: '', reason: '', type: 'ADJUSTMENT' })}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-semibold py-2 rounded-lg cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export interface EditProductForm {
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
}

interface EditProductModalProps {
  editProduct: EditProductForm;
  setEditProduct: React.Dispatch<React.SetStateAction<EditProductForm>>;
  products: Product[];
  setProducts: (products: Product[]) => void;
}

export function EditProductModal({ editProduct, setEditProduct, products, setProducts }: EditProductModalProps) {
  const { API_BASE, secureFetch, isSandboxMode, fetchAllData } = useShop();

  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct.product) return;

    const payload = {
      name: editProduct.name,
      sku: editProduct.sku,
      barcode: editProduct.barcode,
      rackLocation: editProduct.rackLocation,
      hsnCode: editProduct.hsnCode,
      cgstRate: Number(editProduct.cgstRate),
      sgstRate: Number(editProduct.sgstRate),
      costPrice: Number(editProduct.costPrice),
      minimumProfitPct: Number(editProduct.minimumProfitPct),
      retailPrice: Number(editProduct.retailPrice),
      wholesalePrice: Number(editProduct.wholesalePrice),
    };

    if (!payload.name.trim()) {
      alert('Product name is required.');
      return;
    }
    if (payload.costPrice < 0 || payload.retailPrice < 0 || payload.wholesalePrice < 0) {
      alert('Pricing values cannot be negative.');
      return;
    }
    if (payload.cgstRate < 0 || payload.sgstRate < 0 || payload.minimumProfitPct < 0) {
      alert('Tax and profit margins cannot be negative.');
      return;
    }

    if (isSandboxMode) {
      const updatedProds = products.map(p => {
        if (p.id === editProduct.product?.id) {
          const prices = [
            { id: '1', level: 'RETAIL', price: payload.retailPrice },
            { id: '2', level: 'WHOLESALE', price: payload.wholesalePrice }
          ];
           const inv = [{ ...p.stockLevels?.[0], costPrice: payload.costPrice }];
          return {
            ...p,
            name: payload.name,
            sku: payload.sku,
            barcode: payload.barcode,
            rackLocation: payload.rackLocation,
            hsnCode: payload.hsnCode,
            cgstRate: payload.cgstRate,
            sgstRate: payload.sgstRate,
            minimumProfitPct: payload.minimumProfitPct,
            priceLevels: prices,
            stockLevels: inv,
          } as any;
        }
        return p;
      });
      setProducts(updatedProds);
      setEditProduct(prev => ({ ...prev, show: false }));
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/products/${editProduct.product.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditProduct(prev => ({ ...prev, show: false }));
        fetchAllData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to update product details');
      }
    } catch (e) {
      alert('Network issue updating product details');
    }
  };

  return (
    <AnimatePresence>
      {editProduct.show && editProduct.product && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[420px] shadow-2xl relative my-8"
          >
            <h3 className="text-base font-bold text-white mb-1">Edit Product Specifications</h3>
            <p className="text-xs text-neutral-400 mb-4">Owner panel: Configure margins, prices, and settings.</p>

            <form onSubmit={handleEditProductSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Product SKU</label>
                  <input 
                    type="text"
                    value={editProduct.sku}
                    onChange={e => setEditProduct({ ...editProduct, sku: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Barcode</label>
                  <input 
                    type="text"
                    value={editProduct.barcode}
                    onChange={e => setEditProduct({ ...editProduct, barcode: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Product Name</label>
                <input 
                  type="text"
                  value={editProduct.name}
                  onChange={e => setEditProduct({ ...editProduct, name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">HSN Code</label>
                  <input 
                    type="text"
                    value={editProduct.hsnCode}
                    onChange={e => setEditProduct({ ...editProduct, hsnCode: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">CGST Rate (%)</label>
                  <input 
                    type="number"
                    value={editProduct.cgstRate}
                    onChange={e => setEditProduct({ ...editProduct, cgstRate: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">SGST Rate (%)</label>
                  <input 
                    type="number"
                    value={editProduct.sgstRate}
                    onChange={e => setEditProduct({ ...editProduct, sgstRate: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Rack Location</label>
                  <input 
                    type="text"
                    value={editProduct.rackLocation}
                    onChange={e => setEditProduct({ ...editProduct, rackLocation: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Min Profit Margin (%)</label>
                  <input 
                    type="number"
                    value={editProduct.minimumProfitPct}
                    onChange={e => setEditProduct({ ...editProduct, minimumProfitPct: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-neutral-800 pt-3">
                <div>
                  <label className="block text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">Cost Price (₹)</label>
                  <input 
                    type="number"
                    value={editProduct.costPrice}
                    onChange={e => setEditProduct({ ...editProduct, costPrice: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">MRP (Optional) (₹)</label>
                  <input 
                    type="number"
                    value={editProduct.mrp}
                    onChange={e => setEditProduct({ ...editProduct, mrp: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-green-400 uppercase tracking-wider mb-1">Level 1 (Ideal) (₹)</label>
                  <input 
                    type="number"
                    value={editProduct.level1Price}
                    onChange={e => setEditProduct({ ...editProduct, level1Price: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-1">Level 2 (Default) (₹)</label>
                  <input 
                    type="number"
                    value={editProduct.level2Price}
                    onChange={e => setEditProduct({ ...editProduct, level2Price: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-violet-400 uppercase tracking-wider mb-1">Level 3 (Min) (₹)</label>
                  <input 
                    type="number"
                    value={editProduct.level3Price}
                    onChange={e => setEditProduct({ ...editProduct, level3Price: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-red-400 uppercase tracking-wider mb-1">Emergency Limit Price (₹)</label>
                <input 
                  type="number"
                  value={editProduct.emergencyPrice}
                  onChange={e => setEditProduct({ ...editProduct, emergencyPrice: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditProduct({ ...editProduct, show: false })}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-semibold py-2 rounded-lg cursor-pointer"
                >
                  Save Specifications
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface RecycleBinModalProps {
  showRecycleBin: boolean;
  setShowRecycleBin: (show: boolean) => void;
  products: Product[];
}

export function RecycleBinModal({ showRecycleBin, setShowRecycleBin, products }: RecycleBinModalProps) {
  const { API_BASE, secureFetch, user, fetchAllData } = useShop();

  const restoreProduct = async (pId: string) => {
    try {
      const res = await secureFetch(`${API_BASE}/products/${pId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.userId })
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Product restored successfully!');
      fetchAllData();
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    }
  };

  return (
    <AnimatePresence>
      {showRecycleBin && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900 border border-neutral-850 p-6 rounded-2xl w-full max-w-[650px] shadow-2xl relative space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white tracking-tight">Recycle Bin (Soft Deleted Products)</h3>
              <button 
                onClick={() => setShowRecycleBin(false)}
                className="text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto pr-1">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-neutral-800 text-[10px] text-neutral-500">
                    <th className="py-2">Name</th>
                    <th className="py-2">SKU</th>
                    <th className="py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {products.filter(p => p.isDeleted).map(p => (
                    <tr key={p.id} className="text-xs">
                      <td className="py-2 text-white font-semibold">{p.name}</td>
                      <td className="py-2 font-mono text-neutral-400">{p.sku}</td>
                      <td className="py-2 text-center">
                        <button 
                          onClick={() => restoreProduct(p.id)}
                          className="bg-neutral-850 hover:bg-neutral-750 text-green-400 font-semibold px-2 py-1 rounded text-[10px]"
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                  {products.filter(p => p.isDeleted).length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-6 text-neutral-500 text-xs">
                        No soft-deleted products in Recycle Bin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
