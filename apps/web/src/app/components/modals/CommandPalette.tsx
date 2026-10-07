'use client';

import React from 'react';
import { Search } from 'lucide-react';

export interface Command {
  id: string;
  name: string;
  category: string;
  shortcut: string;
  action: () => void;
}

// Keyboard navigation (arrows / Enter / Escape) is handled by the global keydown listener in page.tsx
interface CommandPaletteProps {
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  commands: Command[];
  commandPaletteSearch: string;
  setCommandPaletteSearch: (value: string) => void;
  commandPaletteIndex: number;
  setCommandPaletteIndex: (index: number) => void;
}

// Global Command Palette Modal (Ctrl + K)
export default function CommandPalette({
  isCommandPaletteOpen,
  setIsCommandPaletteOpen,
  commands,
  commandPaletteSearch,
  setCommandPaletteSearch,
  commandPaletteIndex,
  setCommandPaletteIndex,
}: CommandPaletteProps) {
  return (
    <>
    {isCommandPaletteOpen && (
      <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]">
        <div className="w-full max-w-[550px] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[450px]">
          {/* Palette Search Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-800">
            <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            <input 
              type="text"
              placeholder="Type a command or shortcut... (e.g. POS, inventory)"
              value={commandPaletteSearch}
              onChange={e => {
                setCommandPaletteSearch(e.target.value);
                setCommandPaletteIndex(0);
              }}
              className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-neutral-500 font-mono"
              autoFocus
            />
            <span className="text-[10px] text-neutral-500 font-bold bg-neutral-950 px-2 py-1 border border-neutral-850 rounded-md uppercase shrink-0">ESC</span>
          </div>

          {/* Commands List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {commands.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-xs">
                No matching commands found.
              </div>
            ) : (
              commands.map((cmd, idx) => (
                <div 
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    setIsCommandPaletteOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                    idx === commandPaletteIndex 
                      ? 'bg-violet-600 text-white font-medium shadow-md shadow-violet-600/10' 
                      : 'text-neutral-300 hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-mono ${
                      idx === commandPaletteIndex ? 'bg-violet-500 text-white' : 'bg-neutral-950 text-neutral-400 border border-neutral-850/50'
                    }`}>
                      {cmd.category}
                    </span>
                    <span className="text-xs font-semibold">{cmd.name}</span>
                  </div>
                  <kbd className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    idx === commandPaletteIndex ? 'bg-violet-500 text-white' : 'bg-neutral-950 text-neutral-500 border border-neutral-850/50'
                  }`}>
                    {cmd.shortcut}
                  </kbd>
                </div>
              ))
            )}
          </div>
          
          {/* Palette Footer Help bar */}
          <div className="px-4 py-2.5 border-t border-neutral-800 text-[10px] text-neutral-500 flex justify-between items-center bg-neutral-950/40">
            <span>Use Up/Down arrows to navigate, Enter to select</span>
            <span>Ctrl + K to close</span>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
