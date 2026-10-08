'use client';

import React, { useState } from 'react';
import { Store, Users } from 'lucide-react';
import TabPane from './TabPane';
import StaffSection from '../admin/StaffSection';
import ShopProfileSection from '../admin/ShopProfileSection';

type Section = 'staff' | 'shop';

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'shop', label: 'Shop profile', icon: Store },
];

// Owner-only: staff accounts and the shop details printed on invoices.
export default function UsersTab() {
  const [section, setSection] = useState<Section>('staff');

  return (
    <TabPane className="flex-1 flex flex-col p-6 overflow-hidden h-full space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Users & Shop</h2>
          <p className="text-xs text-neutral-400 mt-1">Staff accounts, roles and PINs, and the shop details printed on invoices.</p>
        </div>
        <div className="flex gap-1" role="tablist">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={section === s.id}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  section === s.id ? 'bg-white text-neutral-950' : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {section === 'staff' ? <StaffSection /> : <ShopProfileSection />}
    </TabPane>
  );
}
