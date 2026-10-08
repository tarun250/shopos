'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { authFetch, formatInr } from '../../lib/authFetch';

interface InvoiceData {
  shop: Record<string, string>;
  bill: any;
  amountInWords: string;
  hsnSummary: Array<{ hsn: string; rate: number; taxable: number; cgst: number; sgst: number }>;
  whatsapp: { phone: string | null; text: string };
  upiLink: string | null;
}

function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const format = search.get('format') === 'receipt' ? 'receipt' : 'a4';
  const autoPrint = search.get('print') === '1';
  const [data, setData] = useState<InvoiceData | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    authFetch(`/billing/bills/${encodeURIComponent(id)}/invoice`)
      .then(async res => {
        if (!res.ok) throw new Error(res.status === 401 ? 'Please sign in to ShopOS first.' : res.status === 404 ? 'Bill not found.' : `Could not load the bill (${res.status}).`);
        const json: InvoiceData = await res.json();
        setData(json);
        if (json.upiLink) setQr(await QRCode.toDataURL(json.upiLink, { margin: 1, width: format === 'receipt' ? 140 : 120 }));
      })
      .catch(err => setError(err.message));
  }, [id, format]);

  useEffect(() => {
    if (data && autoPrint) setTimeout(() => window.print(), 300);
  }, [data, autoPrint]);

  useEffect(() => {
    document.title = data ? `${data.bill.isQuote ? 'Quotation' : 'Invoice'} ${data.bill.billNumber}` : 'Invoice';
  }, [data]);

  if (error) return <p style={{ padding: 32, fontFamily: 'sans-serif' }}>{error}</p>;
  if (!data) return <p style={{ padding: 32, fontFamily: 'sans-serif', color: '#666' }}>Loading…</p>;

  const { shop, bill } = data;
  const title = bill.isQuote ? 'QUOTATION' : bill.customer?.gstin ? 'TAX INVOICE' : 'TAX INVOICE (B2C)';
  const customer = bill.customer && bill.customer.phone !== '0000000000' ? bill.customer : null;
  const date = new Date(bill.offlineCreatedAt || bill.createdAt);
  const switchTo = (f: string) => `?format=${f}`;

  const toolbar = (
    <div className="no-print" style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid #ddd', background: '#f6f6f6', fontFamily: 'sans-serif', flexWrap: 'wrap' }}>
      <button onClick={() => window.print()} style={btn('#4f46e5', '#fff')}>Print</button>
      <a href={switchTo(format === 'a4' ? 'receipt' : 'a4')} style={btn('#fff', '#222')}>{format === 'a4' ? 'Thermal receipt' : 'A4 invoice'}</a>
      {data.whatsapp.phone && (
        <a href={`https://wa.me/${data.whatsapp.phone}?text=${encodeURIComponent(data.whatsapp.text)}`} target="_blank" rel="noreferrer" style={btn('#16a34a', '#fff')}>Send on WhatsApp</a>
      )}
      <button onClick={() => window.close()} style={btn('#fff', '#222')}>Close</button>
    </div>
  );

  if (format === 'receipt') {
    return (
      <>
        <style>{`@page { size: 80mm auto; margin: 3mm; } @media print { .no-print { display: none !important; } } body { background: #fff; }`}</style>
        {toolbar}
        <div style={{ width: '74mm', margin: '0 auto', padding: '4mm 0', fontFamily: '"Courier New", monospace', fontSize: 11, color: '#000' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{shop.name}</div>
            {shop.address && <div>{shop.address}</div>}
            {shop.phone && <div>Ph: {shop.phone}</div>}
            {shop.gstin && <div>GSTIN: {shop.gstin}</div>}
            <div style={{ margin: '4px 0', fontWeight: 700 }}>{bill.isQuote ? 'QUOTATION' : 'TAX INVOICE'}</div>
          </div>
          <div>Bill: {bill.billNumber}</div>
          <div>Date: {date.toLocaleString('en-IN')}</div>
          {customer && <div>To: {customer.name} ({customer.phone})</div>}
          <hr style={hr} />
          {bill.items.map((i: any) => (
            <div key={i.id} style={{ marginBottom: 3 }}>
              <div>{i.product.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{i.quantity} × {(i.unitPrice - i.discount).toFixed(2)} +{i.cgstRate + i.sgstRate}%</span>
                <span>{i.totalPrice.toFixed(2)}</span>
              </div>
            </div>
          ))}
          <hr style={hr} />
          <Row label="Taxable" value={bill.totalAmount} />
          <Row label="CGST" value={bill.cgstAmount} />
          <Row label="SGST" value={bill.sgstAmount} />
          {bill.discountAmount > 0 && <Row label="Discount" value={-bill.discountAmount} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}><span>TOTAL</span><span>{formatInr(bill.netAmount)}</span></div>
          <Row label={`Paid (${bill.paymentMethod})`} value={bill.paidAmount} />
          {bill.balanceAmount > 0 && !bill.isQuote && <Row label="Balance due" value={bill.balanceAmount} />}
          {qr && <div style={{ textAlign: 'center', marginTop: 6 }}><img src={qr} alt="UPI QR" style={{ width: 120 }} /><div>Scan to pay {formatInr(bill.balanceAmount)}</div></div>}
          <hr style={hr} />
          <div style={{ textAlign: 'center' }}>{shop.invoiceFooter}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`@page { size: A4; margin: 12mm; } @media print { .no-print { display: none !important; } } body { background: #fff; }
        .inv td, .inv th { border: 1px solid #999; padding: 4px 6px; } .inv th { background: #f0f0f0; text-align: left; }`}</style>
      {toolbar}
      <div style={{ maxWidth: '186mm', margin: '0 auto', padding: '8mm 0', fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #111', paddingBottom: 8 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{shop.name}</div>
            {shop.address && <div>{shop.address}</div>}
            <div>{[shop.phone && `Ph: ${shop.phone}`, shop.email].filter(Boolean).join(' · ')}</div>
            {shop.gstin && <div><b>GSTIN:</b> {shop.gstin}{shop.state && ` · State: ${shop.state}`}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
            <div><b>No:</b> {bill.billNumber}</div>
            <div><b>Date:</b> {date.toLocaleDateString('en-IN')}</div>
            <div><b>Payment:</b> {bill.paymentMethod}</div>
          </div>
        </div>

        <div style={{ margin: '10px 0', padding: 8, border: '1px solid #ccc' }}>
          <b>Bill to:</b> {customer ? customer.name : 'Walk-in customer'}
          {customer && <div>{[customer.phone, customer.address].filter(Boolean).join(' · ')}</div>}
          {customer?.gstin && <div><b>GSTIN:</b> {customer.gstin}</div>}
        </div>

        <table className="inv" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th>#</th><th>Item</th><th>HSN</th><th style={r}>Qty</th><th style={r}>Rate</th><th style={r}>Disc</th><th style={r}>Taxable</th><th style={r}>GST</th><th style={r}>Amount</th></tr>
          </thead>
          <tbody>
            {bill.items.map((i: any, n: number) => (
              <tr key={i.id}>
                <td>{n + 1}</td>
                <td>{i.product.name}<div style={{ fontSize: 10, color: '#666' }}>{i.product.sku}</div></td>
                <td>{i.product.hsnCode || '-'}</td>
                <td style={r}>{i.quantity} {i.product.baseUnit?.abbreviation}</td>
                <td style={r}>{i.unitPrice.toFixed(2)}</td>
                <td style={r}>{i.discount ? (i.discount * i.quantity).toFixed(2) : '-'}</td>
                <td style={r}>{(i.quantity * (i.unitPrice - i.discount)).toFixed(2)}</td>
                <td style={r}>{i.cgstRate + i.sgstRate}%</td>
                <td style={r}>{i.totalPrice.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <div><b>Amount in words:</b> {data.amountInWords}</div>
            <table className="inv" style={{ borderCollapse: 'collapse', marginTop: 8, fontSize: 11 }}>
              <thead><tr><th>HSN</th><th style={r}>Taxable</th><th style={r}>Rate</th><th style={r}>CGST</th><th style={r}>SGST</th></tr></thead>
              <tbody>
                {data.hsnSummary.map(h => (
                  <tr key={`${h.hsn}-${h.rate}`}><td>{h.hsn}</td><td style={r}>{h.taxable.toFixed(2)}</td><td style={r}>{h.rate}%</td><td style={r}>{h.cgst.toFixed(2)}</td><td style={r}>{h.sgst.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ width: 230 }}>
            <Row label="Taxable value" value={bill.totalAmount} />
            <Row label="CGST" value={bill.cgstAmount} />
            <Row label="SGST" value={bill.sgstAmount} />
            {bill.discountAmount > 0 && <Row label="Bill discount" value={-bill.discountAmount} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid #111', marginTop: 4, paddingTop: 4 }}>
              <span>Total</span><span>{formatInr(bill.netAmount)}</span>
            </div>
            <Row label="Paid" value={bill.paidAmount} />
            {bill.balanceAmount > 0 && !bill.isQuote && <Row label="Balance due" value={bill.balanceAmount} bold />}
            {qr && <div style={{ textAlign: 'center', marginTop: 8 }}><img src={qr} alt="UPI QR" /><div style={{ fontSize: 10 }}>Scan with any UPI app to pay</div></div>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, fontSize: 11 }}>
          <div style={{ maxWidth: '60%' }}><b>Terms:</b> {shop.invoiceTerms}<div style={{ marginTop: 6 }}>{shop.invoiceFooter}</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ height: 40 }} />For {shop.name}<br />Authorised signatory</div>
        </div>
      </div>
    </>
  );
}

const r: React.CSSProperties = { textAlign: 'right' };
const hr: React.CSSProperties = { border: 0, borderTop: '1px dashed #000', margin: '4px 0' };
const btn = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, border: '1px solid #ccc', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', textDecoration: 'none' });

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 700 : 400 }}>
      <span>{label}</span>
      <span>{formatInr(value)}</span>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={null}>
      <InvoiceView />
    </Suspense>
  );
}
