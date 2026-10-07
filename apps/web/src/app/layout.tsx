import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SHOPOS — Premium ERP & Billing POS',
  description: 'AI-Powered ERP, billing, and inventory tracking for auto parts, electrical, and hardware stores.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full scroll-smooth antialiased dark">
      <body className="min-h-full bg-neutral-950 text-neutral-100 font-sans selection:bg-neutral-800 selection:text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
