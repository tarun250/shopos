'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShop } from '../../ShopContext';
import type { Category, Product, Supplier, Unit } from '../../types';

interface ProductWizardModalProps {
  showCreateWizard: boolean;
  setShowCreateWizard: (show: boolean) => void;
  products: Product[];
  categories: Category[];
  units: Unit[];
  suppliers: Supplier[];
}

// OVERLAY G: Shopify-Style Product Creation Wizard
export default function ProductWizardModal({ showCreateWizard, setShowCreateWizard, products, categories, units, suppliers }: ProductWizardModalProps) {
  const { API_BASE, secureFetch, user, fetchAllData } = useShop();

  // Shopify-Style Product Creation Wizard state
  const [wizardStep, setWizardStep] = useState(0);
  const [aiDuplicates, setAiDuplicates] = useState<any[]>([]);
  const [aiInputQuery, setAiInputQuery] = useState('');
  const [isAiExtracting, setIsAiExtracting] = useState(false);
  
  const [wizardData, setWizardData] = useState({
    sku: '',
    barcode: '',
    name: '',
    description: '',
    categoryId: '',
    baseUnitId: '',
    rackLocation: '',
    minimumProfitPct: '10',
    hsnCode: '',
    cgstRate: '9',
    sgstRate: '9',
    igstRate: '18',
    mrp: '',
    costPrice: '0',
    level1Price: '0',
    level2Price: '0',
    level3Price: '0',
    emergencyPrice: '0',
    openingStock: '0',
    minStockLevel: '0',
    supplierId: '',
    variants: [] as Array<{ name: string; sku: string; barcode: string; price: string }>,
    relationships: [] as Array<{ relatedProductId: string; type: string }>,
  });

  const [varForm, setVarForm] = useState({ name: '', sku: '', barcode: '', price: '' });
  const [relForm, setRelForm] = useState({ relatedProductId: '', type: 'COMPATIBLE' });

  // ==========================================
  // Product Creation Wizard Helper Logic
  // ==========================================

  const handleWizardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await secureFetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: wizardData.sku || `SKU-${Date.now().toString().slice(-6)}`,
          barcode: wizardData.barcode || null,
          name: wizardData.name,
          description: wizardData.description || null,
          rackLocation: wizardData.rackLocation || null,
          minimumProfitPct: Number(wizardData.minimumProfitPct || 10.0),
          hsnCode: wizardData.hsnCode || null,
          cgstRate: Number(wizardData.cgstRate || 0.0),
          sgstRate: Number(wizardData.sgstRate || 0.0),
          igstRate: Number(wizardData.igstRate || 0.0),
          mrp: wizardData.mrp ? Number(wizardData.mrp) : null,
          level1Price: Number(wizardData.level1Price || 0.0),
          level2Price: Number(wizardData.level2Price || 0.0),
          level3Price: Number(wizardData.level3Price || 0.0),
          emergencyPrice: Number(wizardData.emergencyPrice || 0.0),
          categoryId: wizardData.categoryId || null,
          baseUnitId: wizardData.baseUnitId,
          openingStock: Number(wizardData.openingStock || 0.0),
          minStockLevel: Number(wizardData.minStockLevel || 0.0),
          costPrice: Number(wizardData.costPrice || 0.0),
          variants: wizardData.variants,
          userId: user?.userId,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      
      alert('Product created successfully using the wizard!');
      setShowCreateWizard(false);
      setWizardStep(0);
      setWizardData({
        sku: '',
        barcode: '',
        name: '',
        description: '',
        categoryId: '',
        baseUnitId: '',
        rackLocation: '',
        minimumProfitPct: '10',
        hsnCode: '',
        cgstRate: '9',
        sgstRate: '9',
        igstRate: '18',
        mrp: '',
        costPrice: '0',
        level1Price: '0',
        level2Price: '0',
        level3Price: '0',
        emergencyPrice: '0',
        openingStock: '0',
        minStockLevel: '0',
        supplierId: '',
        variants: [],
        relationships: [],
      });
      fetchAllData();
    } catch (err: any) {
      alert(`Wizard creation failed: ${err.message}`);
    }
  };

  const applyTemplate = (type: string) => {
    if (type === 'electrical') {
      setWizardData(prev => ({
        ...prev,
        categoryId: categories.find(c => c.name === 'Electricals')?.id || '',
        baseUnitId: units.find(u => u.abbreviation === 'pc')?.id || '',
        cgstRate: '9',
        sgstRate: '9',
        igstRate: '18',
        minimumProfitPct: '12',
        hsnCode: '85395200',
      }));
    } else if (type === 'automobile') {
      setWizardData(prev => ({
        ...prev,
        categoryId: categories.find(c => c.name === 'Auto Spares')?.id || '',
        baseUnitId: units.find(u => u.abbreviation === 'pc')?.id || '',
        cgstRate: '14',
        sgstRate: '14',
        igstRate: '28',
        minimumProfitPct: '15',
        hsnCode: '85111000',
      }));
    } else if (type === 'hardware') {
      setWizardData(prev => ({
        ...prev,
        categoryId: categories.find(c => c.name === 'Hardware & Tools')?.id || '',
        baseUnitId: units.find(u => u.abbreviation === 'pc')?.id || '',
        cgstRate: '9',
        sgstRate: '9',
        igstRate: '18',
        minimumProfitPct: '8',
        hsnCode: '73181500',
      }));
    }
  };

  const handleAiExtract = async () => {
    if (!aiInputQuery) return;
    setIsAiExtracting(true);
    try {
      const res = await secureFetch(`${API_BASE}/products/ai-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiInputQuery })
      });
      if (res.ok) {
        const data = await res.json();
        setWizardData(prev => ({
          ...prev,
          name: `${data.brand || ''} ${data.variant || ''} ${data.volume || ''}`.trim(),
          hsnCode: data.hsn || '',
          cgstRate: String(data.gst ? data.gst / 2 : 9.0),
          sgstRate: String(data.gst ? data.gst / 2 : 9.0),
          igstRate: String(data.gst || 18.0),
          categoryId: categories.find(c => c.name.toLowerCase().includes(data.category?.toLowerCase() || ''))?.id || prev.categoryId,
          baseUnitId: units.find(u => u.name.toLowerCase().includes(data.units?.toLowerCase() || ''))?.id || prev.baseUnitId,
        }));
        alert(`AI Extracted successfully! Confidence: ${data.confidence || 1.0}`);
      }
    } catch (err: any) {
      alert(`AI Extraction failed: ${err.message}`);
    } finally {
      setIsAiExtracting(false);
    }
  };

  const copyProductDetails = (productId: string) => {
    const src = products.find(p => p.id === productId);
    if (!src) return;
    const retail = src.priceLevels.find(pl => pl.level === 'RETAIL')?.price || 0;
    const wholesale = src.priceLevels.find(pl => pl.level === 'WHOLESALE')?.price || 0;
    const cost = src.stockLevels?.[0]?.costPrice || 0;

    setWizardData(prev => ({
      ...prev,
      name: `${src.name} (Copy)`,
      description: src.description || '',
      categoryId: src.categoryId || '',
      baseUnitId: src.baseUnitId || '',
      rackLocation: src.rackLocation || '',
      minimumProfitPct: String(src.minimumProfitPct),
      hsnCode: src.hsnCode || '',
      cgstRate: String(src.cgstRate),
      sgstRate: String(src.sgstRate),
      igstRate: String(src.igstRate),
      mrp: src.mrp ? String(src.mrp) : '',
      costPrice: String(cost),
      level1Price: String(src.level1Price),
      level2Price: String(src.level2Price),
      level3Price: String(src.level3Price),
      emergencyPrice: String(src.emergencyPrice),
    }));
  };

  return (
    <AnimatePresence>
      {showCreateWizard && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-[850px] shadow-2xl flex overflow-hidden min-h-[500px]"
          >
            {/* Wizard Sidebar tabs */}
            <div className="w-48 bg-neutral-950 border-r border-neutral-850 p-4 space-y-2 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Product Wizard</h4>
                <div className="space-y-1 text-xs">
                  {['General Info', 'Pricing Engine', 'Stock & Vendor', 'Variants', 'Relationships', 'Review & Save'].map((name, idx) => (
                    <div 
                      key={idx}
                      className={`px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        wizardStep === idx ? 'bg-violet-600 text-white font-bold' : 'text-neutral-400 hover:bg-neutral-900'
                      }`}
                      onClick={() => setWizardStep(idx)}
                    >
                      {idx + 1}. {name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/80 text-[10px] text-neutral-500">
                Shopify POS mode active
              </div>
            </div>

            {/* Wizard Main Content Panel */}
            <div className="flex-1 flex flex-col p-6 min-h-[500px]">
              <form onSubmit={handleWizardSubmit} className="flex-1 flex flex-col justify-between text-xs space-y-6">
                
                {/* STEP 0: General Info */}
                {wizardStep === 0 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-neutral-850">
                      <h3 className="text-sm font-bold text-white">General Product Information</h3>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => applyTemplate('electrical')} className="px-2 py-1 rounded bg-neutral-850 text-[10px] text-neutral-300 hover:bg-neutral-700">Apply Electrical Template</button>
                        <button type="button" onClick={() => applyTemplate('automobile')} className="px-2 py-1 rounded bg-neutral-850 text-[10px] text-neutral-300 hover:bg-neutral-700">Apply Auto Template</button>
                      </div>
                    </div>

                    {/* AI Extractor */}
                    <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-850 space-y-2">
                      <label className="block text-[9px] font-bold text-violet-400 uppercase tracking-wider">AI product details parser assistant</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="e.g. Philips LED Bulb 12W White Piece, HSN 85395200"
                          value={aiInputQuery}
                          onChange={e => setAiInputQuery(e.target.value)}
                          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-white focus:outline-none"
                        />
                        <button 
                          type="button" 
                          onClick={handleAiExtract} 
                          disabled={isAiExtracting}
                          className="bg-violet-600 hover:bg-violet-750 text-white font-semibold px-3 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          {isAiExtracting ? 'Extracting...' : 'AI Extract'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">SKU (Auto/Manual)</label>
                        <input 
                          type="text"
                          placeholder="e.g. ELE-LED-12W"
                          value={wizardData.sku}
                          onChange={e => setWizardData({ ...wizardData, sku: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Barcode (Optional)</label>
                        <input 
                          type="text"
                          value={wizardData.barcode}
                          onChange={e => setWizardData({ ...wizardData, barcode: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Product Name</label>
                      <input 
                        type="text"
                        value={wizardData.name}
                        onChange={e => setWizardData({ ...wizardData, name: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                        required
                      />
                      {aiDuplicates.length > 0 && (
                        <div className="mt-2 bg-red-955/20 border border-red-900/40 p-2 rounded-lg text-[10px] text-red-400">
                          Potential Duplicate Alert: Similar products exist with name "{aiDuplicates[0].name}" (SKU: {aiDuplicates[0].sku})
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Category</label>
                        <select 
                          value={wizardData.categoryId}
                          onChange={e => setWizardData({ ...wizardData, categoryId: e.target.value })}
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
                          value={wizardData.baseUnitId}
                          onChange={e => setWizardData({ ...wizardData, baseUnitId: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-neutral-300 focus:outline-none"
                          required
                        >
                          <option value="">Select Unit</option>
                          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Rack Location</label>
                        <input 
                          type="text"
                          value={wizardData.rackLocation}
                          onChange={e => setWizardData({ ...wizardData, rackLocation: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">HSN Code</label>
                        <input 
                          type="text"
                          value={wizardData.hsnCode}
                          onChange={e => setWizardData({ ...wizardData, hsnCode: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">IGST Rate (%)</label>
                        <input 
                          type="number"
                          value={wizardData.igstRate}
                          onChange={e => setWizardData({ ...wizardData, igstRate: e.target.value, cgstRate: String(Number(e.target.value)/2), sgstRate: String(Number(e.target.value)/2) })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 1: Pricing Engine */}
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white pb-2 border-b border-neutral-850">Pricing & Margins</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">Cost Price (₹)</label>
                        <input 
                          type="number"
                          value={wizardData.costPrice}
                          onChange={e => setWizardData({ ...wizardData, costPrice: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">MRP (₹)</label>
                        <input 
                          type="number"
                          value={wizardData.mrp}
                          onChange={e => setWizardData({ ...wizardData, mrp: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 border-t border-neutral-800 pt-3">
                      <div>
                        <label className="block text-[9px] font-bold text-green-400 uppercase tracking-wider mb-1">Level 1 Price (Ideal) (₹)</label>
                        <input 
                          type="number"
                          value={wizardData.level1Price}
                          onChange={e => setWizardData({ ...wizardData, level1Price: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-1">Level 2 Price (Default) (₹)</label>
                        <input 
                          type="number"
                          value={wizardData.level2Price}
                          onChange={e => setWizardData({ ...wizardData, level2Price: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-violet-400 uppercase tracking-wider mb-1">Level 3 Price (Min Limit) (₹)</label>
                        <input 
                          type="number"
                          value={wizardData.level3Price}
                          onChange={e => setWizardData({ ...wizardData, level3Price: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-red-400 uppercase tracking-wider mb-1">Emergency Limit Price (₹)</label>
                        <input 
                          type="number"
                          value={wizardData.emergencyPrice}
                          onChange={e => setWizardData({ ...wizardData, emergencyPrice: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Minimum Profit Margin Target (%)</label>
                        <input 
                          type="number"
                          value={wizardData.minimumProfitPct}
                          onChange={e => setWizardData({ ...wizardData, minimumProfitPct: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    {/* Live Margin Calculation block */}
                    <div className="bg-neutral-955 p-4 rounded-xl border border-neutral-850 font-mono text-[10px] space-y-1">
                      <p className="font-bold text-white text-xs mb-2">Live Profit Preview Calculations</p>
                      <div className="flex justify-between">
                        <span>Ideal Markup (Cost to Level 1):</span>
                        <span className="text-green-400">
                          {Number(wizardData.costPrice) > 0 
                            ? `${(((Number(wizardData.level1Price) - Number(wizardData.costPrice)) / Number(wizardData.costPrice)) * 100).toFixed(1)}%`
                            : '0%'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Default Biller Margin (Level 2):</span>
                        <span className="text-blue-400">
                          {Number(wizardData.level2Price) > 0 
                            ? `${(((Number(wizardData.level2Price) - Number(wizardData.costPrice)) / Number(wizardData.level2Price)) * 100).toFixed(1)}%`
                            : '0%'
                          }
                        </span>
                      </div>
                      {Number(wizardData.level3Price) <= Number(wizardData.costPrice) && (
                        <div className="text-red-400 mt-2 text-[9px] font-sans">
                          ⚠️ Warning: Minimum price (Level 3) is at or below cost price. Loss sale warnings will trigger at checkout!
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 2: Stock & Suppliers */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white pb-2 border-b border-neutral-850">Opening Inventory & Supplier Details</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Opening Stock Quantity</label>
                        <input 
                          type="number"
                          value={wizardData.openingStock}
                          onChange={e => setWizardData({ ...wizardData, openingStock: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Minimum Alert Level (Reorder Point)</label>
                        <input 
                          type="number"
                          value={wizardData.minStockLevel}
                          onChange={e => setWizardData({ ...wizardData, minStockLevel: e.target.value })}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Primary Supplier Mapping</label>
                      <select 
                        value={wizardData.supplierId}
                        onChange={e => setWizardData({ ...wizardData, supplierId: e.target.value })}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-neutral-300 focus:outline-none"
                      >
                        <option value="">Select Supplier Mapping</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.companyName})</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* STEP 3: Variants */}
                {wizardStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white pb-2 border-b border-neutral-850">Product Variants</h3>
                    
                    <div className="bg-neutral-950/40 p-4 rounded-xl border border-neutral-850 grid grid-cols-4 gap-2 items-end">
                      <div>
                        <label className="block text-[9px] text-neutral-400 uppercase mb-1">Variant Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Red, 12W B22"
                          value={varForm.name}
                          onChange={e => setVarForm({ ...varForm, name: e.target.value })}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-neutral-400 uppercase mb-1">SKU</label>
                        <input 
                          type="text" 
                          placeholder="e.g. ELE-LED-9W-RED"
                          value={varForm.sku}
                          onChange={e => setVarForm({ ...varForm, sku: e.target.value })}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-neutral-400 uppercase mb-1">Price (₹)</label>
                        <input 
                          type="number" 
                          placeholder="120"
                          value={varForm.price}
                          onChange={e => setVarForm({ ...varForm, price: e.target.value })}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-white font-mono"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          if (!varForm.name || !varForm.sku || !varForm.price) return;
                          setWizardData(prev => ({
                            ...prev,
                            variants: [...prev.variants, { name: varForm.name, sku: varForm.sku, barcode: varForm.barcode, price: varForm.price }]
                          }));
                          setVarForm({ name: '', sku: '', barcode: '', price: '' });
                        }}
                        className="bg-violet-600 hover:bg-violet-550 text-white font-bold py-1.5 rounded-lg text-[10px]"
                      >
                        Add Variant
                      </button>
                    </div>

                    {/* Variants list table */}
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-neutral-800 text-[10px] text-neutral-500">
                          <th className="py-2">Variant Name</th>
                          <th className="py-2">SKU</th>
                          <th className="py-2 text-right">Price</th>
                          <th className="py-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900">
                        {wizardData.variants.map((v, idx) => (
                          <tr key={idx} className="text-xs">
                            <td className="py-2 font-semibold text-white">{v.name}</td>
                            <td className="py-2 font-mono text-neutral-400">{v.sku}</td>
                            <td className="py-2 text-right font-mono text-white">₹{Number(v.price).toFixed(2)}</td>
                            <td className="py-2 text-center">
                              <button 
                                type="button"
                                onClick={() => setWizardData(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== idx) }))}
                                className="text-red-400 hover:underline"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* STEP 4: Relationships */}
                {wizardStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white pb-2 border-b border-neutral-850">Cross-Sell & Upsell Products Mapping</h3>
                    
                    <div className="bg-neutral-950/40 p-4 rounded-xl border border-neutral-850 grid grid-cols-3 gap-2 items-end">
                      <div>
                        <label className="block text-[9px] text-neutral-400 uppercase mb-1">Select Product</label>
                        <select 
                          value={relForm.relatedProductId}
                          onChange={e => setRelForm({ ...relForm, relatedProductId: e.target.value })}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-neutral-300"
                        >
                          <option value="">Choose item...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] text-neutral-400 uppercase mb-1">Relationship Type</label>
                        <select 
                          value={relForm.type}
                          onChange={e => setRelForm({ ...relForm, type: e.target.value })}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-neutral-300"
                        >
                          <option value="COMPATIBLE">Compatible Accessories</option>
                          <option value="ALTERNATIVE">Alternative Products</option>
                          <option value="UPSELL">Premium Upsell Pair</option>
                        </select>
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          if (!relForm.relatedProductId) return;
                          setWizardData(prev => ({
                            ...prev,
                            relationships: [...prev.relationships, { relatedProductId: relForm.relatedProductId, type: relForm.type }]
                          }));
                          setRelForm({ relatedProductId: '', type: 'COMPATIBLE' });
                        }}
                        className="bg-violet-600 hover:bg-violet-550 text-white font-bold py-1.5 rounded-lg text-[10px]"
                      >
                        Add Mapping
                      </button>
                    </div>

                    {/* Relationships list */}
                    <div className="space-y-2">
                      {wizardData.relationships.map((r, idx) => {
                        const rpName = products.find(p => p.id === r.relatedProductId)?.name || 'Unknown Product';
                        return (
                          <div key={idx} className="flex justify-between items-center bg-neutral-950/20 p-2.5 rounded-lg border border-neutral-850">
                            <div>
                              <span className="font-semibold text-white">{rpName}</span>
                              <span className="text-[10px] text-violet-400 font-mono block uppercase">{r.type}</span>
                            </div>
                            <button 
                              type="button"
                              onClick={() => setWizardData(prev => ({ ...prev, relationships: prev.relationships.filter((_, i) => i !== idx) }))}
                              className="text-red-400 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* STEP 5: Review & Save */}
                {wizardStep === 5 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white pb-2 border-b border-neutral-850">Verify Specifications Summary</h3>
                    
                    <div className="bg-neutral-955 p-4 rounded-xl border border-neutral-850 grid grid-cols-2 gap-4 text-[10px] font-mono text-neutral-400">
                      <div>
                        <span className="text-neutral-500 block uppercase">Product Name:</span>
                        <span className="text-white font-bold">{wizardData.name || 'Not provided'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block uppercase">SKU / Code:</span>
                        <span className="text-white font-mono">{wizardData.sku || 'Auto-generated on save'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block uppercase">Opening Stock:</span>
                        <span className="text-green-400 font-bold">{wizardData.openingStock} {units.find(u => u.id === wizardData.baseUnitId)?.abbreviation || 'pcs'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block uppercase">Cost Price:</span>
                        <span className="text-white">₹{Number(wizardData.costPrice).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block uppercase">Retail Price:</span>
                        <span className="text-white font-bold">₹{Number(wizardData.level1Price).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block uppercase">Supplier Mapping:</span>
                        <span className="text-white">{suppliers.find(s => s.id === wizardData.supplierId)?.name || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Wizard Footer Controls */}
                <div className="flex justify-between items-center border-t border-neutral-800 pt-4 shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setShowCreateWizard(false)}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Cancel Wizard
                  </button>
                  <div className="flex gap-2">
                    {wizardStep > 0 && (
                      <button 
                        type="button" 
                        onClick={() => setWizardStep(prev => prev - 1)}
                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold px-4 py-2 rounded-lg cursor-pointer"
                      >
                        Back
                      </button>
                    )}
                    {wizardStep < 5 ? (
                      <button 
                        type="button" 
                        onClick={() => setWizardStep(prev => prev + 1)}
                        className="bg-violet-600 hover:bg-violet-550 text-white font-semibold px-5 py-2 rounded-lg cursor-pointer"
                      >
                        Next Step
                      </button>
                    ) : (
                      <button 
                        type="submit" 
                        className="bg-white hover:bg-neutral-200 text-neutral-955 font-bold px-6 py-2 rounded-lg cursor-pointer"
                      >
                        Publish Product
                      </button>
                    )}
                  </div>
                </div>

              </form>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
