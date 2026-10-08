'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

/** Camera barcode scanner (EAN/UPC/Code128/QR) for counters without a hardware scanner. */
export default function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [error, setError] = useState('');
  const [lastCode, setLastCode] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');
    setLastCode('');
    (async () => {
      try {
        // Loaded on demand so the scanner library isn't in the main bundle
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader();
        controlsRef.current = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          result => {
            if (!result) return;
            const code = result.getText();
            // Ignore the same code read repeatedly while it stays in front of the camera
            const now = Date.now();
            if (code === lastRef.current.code && now - lastRef.current.at < 2000) return;
            lastRef.current = { code, at: now };
            setLastCode(code);
            onDetectedRef.current(code);
          },
        );
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in the browser to scan.' : err?.name === 'NotFoundError' ? 'No camera was found on this device.' : 'Could not start the camera.');
        }
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Camera className="w-4 h-4" /> Scan barcode</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer" title="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="relative bg-black aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 h-24 border-2 border-violet-400/80 rounded-lg pointer-events-none" />
        </div>
        <div className="px-4 py-3 text-xs">
          {error ? (
            <p className="text-red-400">{error}</p>
          ) : lastCode ? (
            <p className="text-green-400">Scanned <span className="font-mono">{lastCode}</span>, keep scanning or close.</p>
          ) : (
            <p className="text-neutral-400">Hold the barcode inside the box. Each scan adds the item.</p>
          )}
        </div>
      </div>
    </div>
  );
}
