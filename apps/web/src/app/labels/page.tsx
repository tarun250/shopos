'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import JsBarcode from 'jsbarcode';
import { authFetch } from '../lib/authFetch';

interface LabelProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  mrp: number | null;
  level1Price: number;
  cgstRate: number;
  sgstRate: number;
}

// Sheet: A4 with 3 × 8 labels (63.5 × 33.9 mm, e.g. Avery L7160). Thermal: one 50 × 25 mm label per page.
const SIZES = {
  sheet: { page: 'A4', width: '63.5mm', height: '33.9mm' },
  thermal: { page: '50mm 25mm', width: '50mm', height: '25mm' },
} as const;

function Barcode({ value, height }: { value: string; height: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, { format: 'CODE128', height, width: 1.3, fontSize: 10, margin: 0, displayValue: true });
    } catch {
      // invalid characters for CODE128; leave blank
    }
  }, [value, height]);
  return <svg ref={ref} />;
}

function LabelsView() {
  const search = useSearchParams();
  const ids = (search.get('ids') || '').split(',').filter(Boolean);
  const copies = Math.min(Math.max(Number(search.get('copies')) || 1, 1), 200);
  const size = search.get('size') === 'thermal' ? 'thermal' : 'sheet';
  const showPrice = search.get('price') !== 'none';
  const [products, setProducts] = useState<LabelProduct[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ids.length === 0) {
      setError('No products selected.');
      return;
    }
    Promise.all(ids.slice(0, 100).map(id => authFetch(`/products/${id}`).then(r => (r.ok ? r.json() : null))))
      .then(rows => setProducts(rows.filter(Boolean)))
      .catch(() => setError('Could not load products. Make sure you are signed in.'));
  }, [search]);

  const labels = products.flatMap(p => Array.from({ length: copies }, (_, i) => ({ p, key: `${p.id}-${i}` })));
  const dims = SIZES[size];

  return (
    <>
      <style>{`@page { size: ${dims.page}; margin: ${size === 'sheet' ? '13mm 7mm' : '0'}; }
        @media print { .no-print { display: none !important; } }
        body { background: #fff; }
        .label { width: ${dims.width}; height: ${dims.height}; box-sizing: border-box; padding: 1.5mm 2mm; overflow: hidden;
          display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: Arial, sans-serif; color: #000;
          ${size === 'thermal' ? 'page-break-after: always;' : 'outline: 1px dashed #ddd;'} }
        .label svg { max-width: 100%; height: auto; }
        @media print { .label { outline: none; } }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #ddd', background: '#f6f6f6', fontFamily: 'sans-serif', fontSize: 13 }}>
        <button onClick={() => window.print()} style={{ background: '#4f46e5', color: '#fff', border: 0, borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>Print {labels.length} labels</button>
        <span>{size === 'sheet' ? 'A4 sheet, 3 × 8 labels (63.5 × 33.9 mm)' : 'Thermal roll, 50 × 25 mm'}</span>
        {error && <span style={{ color: '#b91c1c' }}>{error}</span>}
      </div>
      <div style={size === 'sheet' ? { display: 'grid', gridTemplateColumns: `repeat(3, ${dims.width})`, gap: '0 2.5mm', justifyContent: 'center', padding: '4mm 0' } : {}}>
        {labels.map(({ p, key }) => {
          const price = p.mrp ?? Math.round(p.level1Price * (1 + (p.cgstRate + p.sgstRate) / 100));
          return (
            <div key={key} className="label">
              <div style={{ fontSize: size === 'sheet' ? 10 : 8, fontWeight: 700, textAlign: 'center', lineHeight: 1.1, maxHeight: '2.3em', overflow: 'hidden' }}>{p.name}</div>
              <Barcode value={p.barcode || p.sku} height={size === 'sheet' ? 32 : 22} />
              {showPrice && <div style={{ fontSize: size === 'sheet' ? 11 : 9, fontWeight: 700 }}>{p.mrp ? 'MRP' : 'Price'} ₹{price.toFixed(2)} <span style={{ fontWeight: 400, fontSize: 8 }}>incl. GST</span></div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function LabelsPage() {
  return (
    <Suspense fallback={null}>
      <LabelsView />
    </Suspense>
  );
}
