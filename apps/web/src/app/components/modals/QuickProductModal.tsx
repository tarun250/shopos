'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShop } from '../../ShopContext';
import type { Category, Product, Unit } from '../../types';

export interface QuickProductForm {
  show: boolean;
  name: string;
  categoryId: string;
  costPrice: string;
  sellingPrice: string;
  baseUnitId: string;
}

interface QuickProductModalProps {
  quickProduct: QuickProductForm;
  setQuickProduct: React.Dispatch<React.SetStateAction<QuickProductForm>>;
  categories: Category[];
  units: Unit[];
  setProducts: (products: Product[]) => void;
  addToCart: (product: Product) => void;
}

export default function QuickProductModal({ quickProduct, setQuickProduct, categories, units, setProducts, addToCart }: QuickProductModalProps) {
  const { API_BASE, secureFetch } = useShop();

  const handleQuickProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProduct.name.trim()) {
      alert('Product name is required.');
      return;
    }
    const cost = Number(quickProduct.costPrice || 0);
    const sell = Number(quickProduct.sellingPrice || 0);
    if (cost < 0 || sell < 0) {
      alert('Price values cannot be negative.');
      return;
    }

    try {
      const res = await secureFetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: `QPROD-${Date.now().toString().slice(-6)}`,
          name: quickProduct.name,
          categoryId: quickProduct.categoryId,
          baseUnitId: quickProduct.baseUnitId,
          costPrice: Number(quickProduct.costPrice || 0),
          level2Price: Number(quickProduct.sellingPrice || 0),
          level1Price: Number(quickProduct.sellingPrice || 0),
          level3Price: Number(quickProduct.sellingPrice || 0),
          openingStock: 0,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const newProd = await res.json();
      
      // Auto-load and addToCart
      const prodRes = await secureFetch(`${API_BASE}/products?take=100`);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData);
        const match = prodData.find((p: any) => p.id === newProd.id);
        if (match) addToCart(match);
      }

      setQuickProduct({
        show: false,
        name: '',
        categoryId: '',
        costPrice: '',
        sellingPrice: '',
        baseUnitId: '',
      });
    } catch (err: any) {
      alert(`Quick product creation failed: ${err.message}`);
    }
  };

  return (
    <AnimatePresence>
      {quickProduct.show && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-[420px] shadow-2xl relative space-y-4"
          >
            <h3 className="text-base font-bold text-white tracking-tight">Quick Create Product</h3>
            <p className="text-xs text-neutral-400">Initialize a missing product instantly to keep billing moving.</p>

            <form onSubmit={handleQuickProductSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Product Name</label>
                <input 
                  type="text"
                  value={quickProduct.name}
                  onChange={e => setQuickProduct({ ...quickProduct, name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Category</label>
                  <select 
                    value={quickProduct.categoryId}
                    onChange={e => setQuickProduct({ ...quickProduct, categoryId: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-neutral-300 focus:outline-none"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Base Unit</label>
                  <select 
                    value={quickProduct.baseUnitId}
                    onChange={e => setQuickProduct({ ...quickProduct, baseUnitId: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-neutral-300 focus:outline-none"
                    required
                  >
                    <option value="">Select Unit</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-neutral-800 pt-3">
                <div>
                  <label className="block text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">Cost Price (₹)</label>
                  <input 
                    type="number"
                    value={quickProduct.costPrice}
                    onChange={e => setQuickProduct({ ...quickProduct, costPrice: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-1">Selling Price (₹)</label>
                  <input 
                    type="number"
                    value={quickProduct.sellingPrice}
                    onChange={e => setQuickProduct({ ...quickProduct, sellingPrice: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setQuickProduct({ ...quickProduct, show: false })}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-white hover:bg-neutral-200 text-neutral-950 font-semibold py-2 rounded-lg cursor-pointer"
                >
                  Save & Add to Cart
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
