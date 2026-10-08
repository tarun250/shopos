'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, Save } from 'lucide-react';
import { useShop } from '../../ShopContext';
import { Field, apiError, inputClass, primaryButton, secondaryButton } from './ui';

export interface ShopProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  state: string;
  upiId: string;
  invoiceFooter: string;
  invoiceTerms: string;
}

const EMPTY: ShopProfile = { name: '', address: '', phone: '', email: '', gstin: '', state: '', upiId: '', invoiceFooter: '', invoiceTerms: '' };

// Same rules as the API (settings/shop-settings.ts)
const GSTIN_RULE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
const UPI_RULE = /^[\w.-]{2,}@[a-zA-Z]{2,}$/;
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(p: ShopProfile): Partial<Record<keyof ShopProfile, string>> {
  const e: Partial<Record<keyof ShopProfile, string>> = {};
  if (p.name.trim().length < 2 || p.name.trim().length > 80) e.name = 'Shop name must be 2-80 characters.';
  if (p.address.length > 250) e.address = 'At most 250 characters.';
  if (p.phone.length > 20) e.phone = 'At most 20 characters.';
  if (p.email.trim() && !EMAIL_RULE.test(p.email.trim())) e.email = 'Enter a valid email address or leave it empty.';
  if (p.gstin && !GSTIN_RULE.test(p.gstin)) e.gstin = 'Not a valid GSTIN (15 characters, e.g. 09AAACH7409R1ZZ).';
  if (p.state.length > 40) e.state = 'At most 40 characters.';
  if (p.upiId && !UPI_RULE.test(p.upiId)) e.upiId = 'UPI ID must look like name@bank.';
  if (p.invoiceFooter.length > 200) e.invoiceFooter = 'At most 200 characters.';
  if (p.invoiceTerms.length > 500) e.invoiceTerms = 'At most 500 characters.';
  return e;
}

export default function ShopProfileSection() {
  const { API_BASE, secureFetch } = useShop();
  const [saved, setSaved] = useState<ShopProfile | null>(null);
  const [form, setForm] = useState<ShopProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await secureFetch(`${API_BASE}/settings/shop`);
      if (!res.ok) {
        setError(await apiError(res, 'Could not load the shop profile'));
        return;
      }
      const data = { ...EMPTY, ...(await res.json()) } as ShopProfile;
      setSaved(data);
      setForm(data);
    } catch {
      setError('Could not reach the server. Check that the API is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = !!saved && (Object.keys(EMPTY) as (keyof ShopProfile)[]).some(k => form[k] !== saved[k]);

  const set = (k: keyof ShopProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = k === 'gstin' ? e.target.value.toUpperCase().replace(/\s/g, '') : k === 'upiId' ? e.target.value.trim() : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
    setSuccess('');
  };

  const save = async () => {
    if (hasErrors || !dirty || !saved) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const body: Partial<ShopProfile> = {};
      (Object.keys(EMPTY) as (keyof ShopProfile)[]).forEach(k => {
        const v = k === 'name' || k === 'email' ? form[k].trim() : form[k];
        if (v !== saved[k]) body[k] = v;
      });
      const res = await secureFetch(`${API_BASE}/settings/shop`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await apiError(res, 'Could not save the shop profile'));
        return;
      }
      const data = await res.json().catch(() => null);
      const next = data && typeof data === 'object' && 'name' in data ? ({ ...EMPTY, ...data } as ShopProfile) : { ...saved, ...body };
      setSaved(next);
      setForm(next);
      setSuccess('Shop profile saved. New invoices will use these details.');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !saved) {
    return <p className="text-xs text-neutral-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading shop profile…</p>;
  }

  return (
    <div className="flex-1 overflow-y-auto pr-1">
      <form
        onSubmit={e => {
          e.preventDefault();
          save();
        }}
        className="max-w-3xl space-y-5 pb-20"
      >
        <p className="text-[11px] text-neutral-400">These details are printed on every invoice and quote. Changes apply to bills printed from now on.</p>

        <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Business details</h3>
          <Field label="Shop name" error={errors.name} help="Printed as the invoice heading.">
            <input value={form.name} onChange={set('name')} className={inputClass} />
          </Field>
          <Field label="Address" error={errors.address} help="Printed under the shop name.">
            <textarea rows={2} value={form.address} onChange={set('address')} placeholder="Shop number, street, area, city" className={`${inputClass} resize-none`} />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Phone" error={errors.phone}>
              <input value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="e.g. 9810000000" className={inputClass} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" value={form.email} onChange={set('email')} placeholder="shop@example.com" className={inputClass} />
            </Field>
            <Field label="GSTIN" error={errors.gstin} help="Leave empty if the shop is not GST-registered.">
              <input value={form.gstin} onChange={set('gstin')} maxLength={15} placeholder="e.g. 09AAACH7409R1ZZ" className={`${inputClass} font-mono`} />
            </Field>
            <Field label="State" error={errors.state} help="Place of supply on tax invoices.">
              <input value={form.state} onChange={set('state')} placeholder="e.g. Uttar Pradesh" className={inputClass} />
            </Field>
          </div>
        </section>

        <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Payments & invoice text</h3>
          <Field
            label="UPI ID"
            error={errors.upiId}
            help="When set, invoices with a balance due show a pay-by-UPI QR code for that amount. Leave empty to hide the QR code."
          >
            <input value={form.upiId} onChange={set('upiId')} placeholder="e.g. shopname@okhdfcbank" className={`${inputClass} font-mono`} />
          </Field>
          <Field label="Invoice footer" error={errors.invoiceFooter} help={`${form.invoiceFooter.length}/200 · Printed at the bottom of each invoice.`}>
            <input value={form.invoiceFooter} onChange={set('invoiceFooter')} className={inputClass} />
          </Field>
          <Field label="Terms & conditions" error={errors.invoiceTerms} help={`${form.invoiceTerms.length}/500 · Return, warranty and payment terms printed on invoices.`}>
            <textarea rows={3} value={form.invoiceTerms} onChange={set('invoiceTerms')} className={`${inputClass} resize-none`} />
          </Field>
        </section>

        {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">{error}</div>}
        {success && (
          <div className="text-xs text-green-400 bg-green-950/40 border border-green-900/40 rounded-lg px-3 py-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {success}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button type="submit" disabled={saving || hasErrors || !dirty} className={primaryButton}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save profile
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => saved && setForm(saved)}
            className={`${secondaryButton} flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Discard changes
          </button>
          {!dirty && !success && saved && <span className="text-[11px] text-neutral-500">No unsaved changes.</span>}
          {hasErrors && dirty && <span className="text-[11px] text-amber-400">Fix the highlighted fields to save.</span>}
        </div>
      </form>
    </div>
  );
}
