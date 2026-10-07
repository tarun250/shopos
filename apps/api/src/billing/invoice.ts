// Invoice helpers: Indian-format amount in words, HSN tax summary and WhatsApp share text.

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ''));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

/** 123456.5 → "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paise Only" */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.round(amount * 100) / 100);
  const paise = Math.round((amount - rupees) * 100);
  const groups: Array<[number, string]> = [
    [Math.floor(rupees / 10000000), 'Crore'],
    [Math.floor((rupees % 10000000) / 100000), 'Lakh'],
    [Math.floor((rupees % 100000) / 1000), 'Thousand'],
    [rupees % 1000, ''],
  ];
  const words = groups
    .filter(([value]) => value > 0)
    .map(([value, label]) => `${value >= 1000 ? amountInWords(value).replace(/^Rupees |\sOnly$/g, '') : belowThousand(value)}${label ? ` ${label}` : ''}`)
    .join(' ');
  return `Rupees ${words || 'Zero'}${paise ? ` and ${belowThousand(paise)} Paise` : ''} Only`;
}

export function hsnSummary(items: Array<{ quantity: number; unitPrice: number; discount: number; cgstRate: number; sgstRate: number; cgstAmount: number; sgstAmount: number; product: { hsnCode: string | null } }>) {
  const map = new Map<string, { hsn: string; rate: number; taxable: number; cgst: number; sgst: number }>();
  for (const i of items) {
    const key = `${i.product.hsnCode || 'NA'}|${i.cgstRate + i.sgstRate}`;
    const row = map.get(key) || { hsn: i.product.hsnCode || 'NA', rate: i.cgstRate + i.sgstRate, taxable: 0, cgst: 0, sgst: 0 };
    row.taxable += i.quantity * (i.unitPrice - i.discount);
    row.cgst += i.cgstAmount;
    row.sgst += i.sgstAmount;
    map.set(key, row);
  }
  return [...map.values()].map(r => ({ ...r, taxable: Math.round(r.taxable * 100) / 100, cgst: Math.round(r.cgst * 100) / 100, sgst: Math.round(r.sgst * 100) / 100 }));
}

export function whatsappText(shopName: string, bill: { billNumber: string; createdAt: Date; netAmount: number; balanceAmount: number; isQuote: boolean; items: Array<{ quantity: number; totalPrice: number; product: { name: string } }> }): string {
  const lines = [
    `*${shopName}*`,
    `${bill.isQuote ? 'Quotation' : 'Invoice'} ${bill.billNumber} · ${bill.createdAt.toLocaleDateString('en-IN')}`,
    '',
    ...bill.items.map(i => `• ${i.product.name} × ${i.quantity} = ₹${i.totalPrice.toFixed(2)}`),
    '',
    `*Total: ₹${bill.netAmount.toFixed(2)}*`,
    ...(bill.balanceAmount > 0 && !bill.isQuote ? [`Balance due: ₹${bill.balanceAmount.toFixed(2)}`] : []),
    '',
    'Thank you!',
  ];
  return lines.join('\n');
}
