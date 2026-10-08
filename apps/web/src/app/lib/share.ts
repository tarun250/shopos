import type { SecureFetch } from '../types';

export const openInvoice = (billId: string, format: 'a4' | 'receipt', print = true) =>
  window.open(`/invoice/${encodeURIComponent(billId)}?format=${format}${print ? '&print=1' : ''}`, '_blank');

/**
 * Opens WhatsApp with the bill summary for the customer's number.
 * The tab is opened synchronously inside the click so pop-up blockers allow it, then pointed at wa.me.
 */
export async function openWhatsAppForBill(apiBase: string, secureFetch: SecureFetch, billId: string) {
  const win = window.open('', '_blank');
  try {
    const res = await secureFetch(`${apiBase}/billing/bills/${encodeURIComponent(billId)}/invoice`);
    if (!res.ok) throw new Error('Could not load the bill.');
    const invoice = await res.json();
    if (!invoice.whatsapp?.phone) throw new Error('This bill has no customer phone number.');
    const url = `https://wa.me/${invoice.whatsapp.phone}?text=${encodeURIComponent(invoice.whatsapp.text)}`;
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch (err: any) {
    win?.close();
    alert(err.message);
  }
}
