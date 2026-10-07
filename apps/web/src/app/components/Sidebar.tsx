'use client';

import React from 'react';
import {
  BookOpen,
  ClipboardCheck,
  Database,
  History,
  Keyboard,
  Layers,
  Lock,
  Package,
  RotateCcw,
  Settings,
  ShoppingCart,
  Sparkles,
  type LucideIcon,
  Truck,
  BarChart3,
  Users,
  Gauge,
} from 'lucide-react';
import type { ActiveUser, TabId } from '../types';

export interface NavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
  // Only these roles see the entry (and the agent may only open it for them). Omit for everyone.
  roles?: string[];
  // Reserve space for a count bubble on the right; the count comes from Sidebar's `badges` prop
  showBadge?: boolean;
}

// Sidebar entries, in display order. The AI agent's "navigate" action also resolves pages from this list.
export const NAV_ITEMS: NavItem[] = [
  { id: 'pos', label: 'POS Billing', icon: ShoppingCart },
  { id: 'inventory', label: 'Products & Stock', icon: Package },
  { id: 'order-history', label: 'Order History', icon: History },
  { id: 'purchases', label: 'Purchases', icon: Truck, roles: ['OWNER', 'MANAGER'] },
  { id: 'reports', label: 'Reports & GST', icon: BarChart3, roles: ['OWNER', 'MANAGER'] },
  { id: 'knowledge-base', label: 'AI Knowledge Base', icon: Sparkles, roles: ['OWNER', 'MANAGER'] },
  { id: 'ai-quality', label: 'AI Quality', icon: Gauge, roles: ['OWNER'] },
  { id: 'users', label: 'Users & Shop', icon: Users, roles: ['OWNER'] },
  { id: 'customer-ledgers', label: 'Customer Ledgers', icon: BookOpen },
  { id: 'supplier-ledgers', label: 'Supplier Ledgers', icon: Database },
  { id: 'returns', label: 'Return Center', icon: RotateCcw },
  { id: 'approvals', label: 'Approval Center', icon: ClipboardCheck, roles: ['OWNER', 'MANAGER'], showBadge: true },
  { id: 'settings', label: 'Dev Console & Logs', icon: Settings },
];

export const canSeeNavItem = (item: NavItem, role: string | undefined) => !item.roles || item.roles.includes(role ?? '');

interface SidebarProps {
  user: ActiveUser;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  badges: Partial<Record<TabId, number>>;
  backendStatus: 'connected' | 'offline';
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  isCompactMode: boolean;
  setIsCompactMode: React.Dispatch<React.SetStateAction<boolean>>;
  setIsCommandPaletteOpen: (open: boolean) => void;
  handleLogout: () => void;
}

export default function Sidebar({
  user,
  activeTab,
  setActiveTab,
  badges,
  backendStatus,
  isDarkMode,
  setIsDarkMode,
  isCompactMode,
  setIsCompactMode,
  setIsCommandPaletteOpen,
  handleLogout,
}: SidebarProps) {
  return (
    <aside className={`w-64 border-r flex flex-col justify-between shrink-0 ${isDarkMode ? 'bg-neutral-900/30 border-neutral-850' : 'bg-white border-neutral-200 shadow-sm'}`}>
      <div>
        {/* Header & Connection status */}
        <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'border-neutral-850' : 'border-neutral-200'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/10">
              <Layers className="text-white w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className={`font-bold tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>SHOPOS</h1>
              <span className="text-[10px] text-neutral-400 mt-1 block font-medium">ERP + Billing Platform</span>
            </div>
          </div>
          {/* Sync Pulse */}
          <div className={`flex items-center gap-1.5 border px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-neutral-950/60 border-neutral-850' : 'bg-neutral-100 border-neutral-200'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'connected' ? 'bg-green-500' : 'bg-amber-500'} sync-anim`} />
            <span className={`text-[8px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>{backendStatus}</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-1">
            {NAV_ITEMS.filter(item => canSeeNavItem(item, user.role)).map(item => {
              const Icon = item.icon;
              const stateClass = activeTab === item.id
                ? (isDarkMode ? 'bg-neutral-800 text-white font-medium' : 'bg-neutral-200 text-neutral-900 font-semibold shadow-sm')
                : (isDarkMode ? 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900');

              if (item.showBadge) {
                const count = badges[item.id] ?? 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${stateClass}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {count > 0 && (
                      <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] h-4 leading-none">
                        {count}
                      </span>
                    )}
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${stateClass}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
        </nav>
      </div>

      {/* Footer profile & controls */}
      <div className={`p-4 border-t space-y-3 ${isDarkMode ? 'border-neutral-850' : 'border-neutral-200'}`}>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-neutral-400 tracking-wider uppercase">Controls</span>
          <div className="flex gap-1.5">
            <button 
              onClick={() => setIsDarkMode(prev => !prev)} 
              title="Toggle Theme"
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                isDarkMode 
                  ? 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800' 
                  : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button 
              onClick={() => setIsCompactMode(prev => !prev)} 
              title="Toggle Compact Mode"
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                isCompactMode 
                  ? 'bg-violet-950/40 border-violet-800/40 text-violet-400 hover:bg-violet-950/50' 
                  : isDarkMode 
                    ? 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800' 
                    : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              🔬
            </button>
            <button 
              onClick={() => setIsCommandPaletteOpen(true)} 
              title="Command Palette"
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                isDarkMode 
                  ? 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800' 
                  : 'bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              ⌨️
            </button>
          </div>
        </div>

        <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
          isDarkMode ? 'bg-neutral-950/40 border-neutral-850' : 'bg-neutral-100 border-neutral-200'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border ${
              isDarkMode ? 'bg-neutral-850 border-neutral-750 text-violet-400' : 'bg-neutral-200 border-neutral-300 text-violet-650'
            }`}>
              {user.fullName.slice(0,2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className={`text-xs font-medium truncate leading-tight ${isDarkMode ? 'text-white' : 'text-neutral-800'}`}>{user.fullName}</p>
              <span className="text-[9px] text-neutral-400 uppercase tracking-wider">{user.role}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="text-neutral-400 hover:text-red-400 transition-colors cursor-pointer" title="Log Out">
            <Lock className="w-4 h-4" />
          </button>
        </div>

        <div className={`text-[10px] p-2 rounded-lg text-center flex items-center justify-center gap-1.5 border ${
          isDarkMode ? 'text-neutral-500 bg-neutral-950/20 border-neutral-900/40' : 'text-neutral-600 bg-neutral-200/50 border-neutral-300/30'
        }`}>
          <Keyboard className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
          <span>Press <kbd className={`font-mono px-1 py-0.5 rounded border text-[9px] ${
            isDarkMode ? 'bg-neutral-950 border-neutral-800 text-neutral-300' : 'bg-neutral-100 border-neutral-300 text-neutral-600'
          }`}>Ctrl + K</kbd> for actions</span>
        </div>
      </div>
    </aside>
  );
}
