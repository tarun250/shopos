'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AiSettingsModalProps {
  showAiSettings: boolean;
  setShowAiSettings: (show: boolean) => void;
  aiSettingsList: any[];
  setAiSettingsList: (list: any[]) => void;
  handleSaveAiSettingsSubmit: (e: React.FormEvent) => void;
}

// OVERLAY M: AI Settings keys config screen
export default function AiSettingsModal({
  showAiSettings,
  setShowAiSettings,
  aiSettingsList,
  setAiSettingsList,
  handleSaveAiSettingsSubmit,
}: AiSettingsModalProps) {
  return (
    <AnimatePresence>
      {showAiSettings && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900 border border-neutral-805 p-6 rounded-2xl w-full max-w-[550px] shadow-2xl relative space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white tracking-tight">AI Settings & Provider Priority</h3>
              <button 
                onClick={() => setShowAiSettings(false)}
                className="text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAiSettingsSubmit} className="space-y-4 text-xs">
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {aiSettingsList.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-2 items-center">
                    <span className="font-mono text-[10px] text-neutral-400">{item.key}:</span>
                    <input 
                      type="text"
                      value={item.value}
                      onChange={e => {
                        const updated = [...aiSettingsList];
                        updated[idx].value = e.target.value;
                        setAiSettingsList(updated);
                      }}
                      className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-white font-mono text-[10px]"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAiSettings(false)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-white hover:bg-neutral-200 text-neutral-955 font-bold py-2 rounded-lg cursor-pointer"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
