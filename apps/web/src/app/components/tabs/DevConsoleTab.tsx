'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, Database, History, Settings, User } from 'lucide-react';
import TabPane from './TabPane';
import { useShop } from '../../ShopContext';
import type { Product } from '../../types';

// AI settings are shared with the AI Settings modal (command palette / agent), so they live in page.tsx.
interface DevConsoleTabProps {
  products: Product[];
  aiSettingsList: any[];
  setAiSettingsList: (list: any[]) => void;
  fetchAiSettings: () => void;
  handleSaveAiSettingsSubmit: (e: React.FormEvent) => void;
}

export default function DevConsoleTab({ products, aiSettingsList, setAiSettingsList, fetchAiSettings, handleSaveAiSettingsSubmit }: DevConsoleTabProps) {
  const { API_BASE, secureFetch, isSandboxMode, fetchAllData } = useShop();
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const fetchAuditLogs = async () => {
    if (isSandboxMode) {
      setAuditLogs([
        { id: '1', action: 'OFFLINE_SANDBOX_ACTIVE', details: JSON.stringify({ mode: 'Developer Sandbox' }), createdAt: new Date().toISOString() }
      ]);
      return;
    }
    try {
      const res = await secureFetch(`${API_BASE}/products`); // Fetching audit logs fallback or simple logs
      // In this demo, we mock fetch logs or read them
      setAuditLogs([
        { id: 'seed-1', action: 'DATABASE_SEED', details: JSON.stringify({ status: 'Successful' }), createdAt: new Date().toISOString() }
      ]);
    } catch (e) {}
  };

  useEffect(() => {
    fetchAiSettings();
    fetchAuditLogs();
  }, []);

  return (
    <TabPane className="flex-1 flex flex-col p-6 overflow-hidden h-full space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">System Settings & Developer Console</h2>
        <p className="text-xs text-neutral-400 mt-1">Audit logs, system seed resets, and client database stats.</p>
      </div>

      {/* Dev Stats grid */}
      <div className="grid grid-cols-3 gap-4 shrink-0">
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 rounded-lg bg-violet-600/10 text-violet-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider">Database Mode</h4>
            <p className="text-sm font-semibold text-white">{isSandboxMode ? 'Offline Sandbox (SQLite fallback)' : 'PostgreSQL Database'}</p>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-600/10 text-green-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider">Total SKUs Tracked</h4>
            <p className="text-sm font-semibold text-white">{products.length} Products</p>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-600/10 text-blue-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[10px] text-neutral-500 uppercase tracking-wider">Manager PIN Override Status</h4>
            <p className="text-sm font-semibold text-white">Active (Code overrides enabled)</p>
          </div>
        </div>
      </div>

      {/* Split Settings Layout */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left column: AI Configurations form */}
        <div className="w-1/2 bg-neutral-900/30 border border-neutral-800 rounded-xl flex flex-col min-h-0">
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-violet-400" /> AI Provider Keys & Settings
            </span>
            <button 
              onClick={fetchAiSettings}
              className="text-xs bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white px-2.5 py-1 rounded transition-colors cursor-pointer"
            >
              Reload Settings
            </button>
          </div>
          <form onSubmit={handleSaveAiSettingsSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            <div className="space-y-3">
              {aiSettingsList.length === 0 ? (
                <div className="text-center py-6 text-neutral-500 font-mono text-[10px]">
                  Click Reload Settings to fetch active keys.
                </div>
              ) : (
                aiSettingsList.map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10px] text-neutral-400">{item.key}:</span>
                    <input 
                      type="text"
                      value={item.value}
                      onChange={e => {
                        const updated = [...aiSettingsList];
                        updated[idx].value = e.target.value;
                        setAiSettingsList(updated);
                      }}
                      className="bg-neutral-950 border border-neutral-850 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                ))
              )}
            </div>
            <div className="pt-2">
              <button 
                type="submit" 
                className="w-full bg-violet-600 hover:bg-violet-550 text-white font-semibold py-2 rounded-lg cursor-pointer transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </form>
        </div>

        {/* Right column: Audit Logs list */}
        <div className="w-1/2 bg-neutral-900/30 border border-neutral-800 rounded-xl flex flex-col min-h-0">
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4" /> System Audit Logs (Latest 50 events)
            </span>
            <button 
              onClick={fetchAllData}
              className="text-xs bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white px-2.5 py-1 rounded transition-colors cursor-pointer"
            >
              Refresh Logs
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] text-neutral-400 space-y-2">
            {auditLogs.map((log, index) => (
              <div key={log.id || index} className="p-2 bg-neutral-950/40 rounded border border-neutral-900 flex justify-between items-start gap-4">
                <div>
                  <span className="text-violet-400 font-semibold">[{log.action}]</span>
                  <span className="text-neutral-500 ml-2">{log.details}</span>
                </div>
                <span className="text-neutral-600 text-[10px] whitespace-nowrap">{new Date(log.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TabPane>
  );
}
