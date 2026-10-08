'use client';

import React, { useState } from 'react';
import TabPane from './TabPane';
import SalesView from '../reports/SalesView';
import GstView from '../reports/GstView';

type View = 'sales' | 'gst';

export default function ReportsTab() {
  const [view, setView] = useState<View>('sales');

  return (
    // Long page: the pane scrolls; bottom padding keeps the last rows clear of the floating AI button
    <TabPane className="flex-1 h-full overflow-y-auto p-6 pb-24 space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Reports &amp; GST</h2>
          <p className="text-xs text-neutral-400 mt-1">
            {view === 'sales'
              ? 'Sales, payments, best sellers, slow stock and customer dues for any period.'
              : 'Monthly working figures for GSTR-1 and GSTR-3B.'}
          </p>
        </div>
        <div role="tablist" aria-label="Report type" className="flex p-1 rounded-xl bg-neutral-900 border border-neutral-800">
          {([['sales', 'Sales'], ['gst', 'GST']] as const).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                view === v ? 'bg-violet-600 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'sales' ? <SalesView /> : <GstView />}
    </TabPane>
  );
}
