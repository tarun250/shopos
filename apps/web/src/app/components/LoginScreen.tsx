'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Layers, RefreshCw } from 'lucide-react';

export interface LoginForm {
  username: string;
  password: string;
}

interface LoginScreenProps {
  authError: string;
  isLoading: boolean;
  onLogin: (form: LoginForm) => void;
  handleQuickBypass: () => void;
}

export default function LoginScreen({ authError, isLoading, onLogin, handleQuickBypass }: LoginScreenProps) {
  const [loginForm, setLoginForm] = useState<LoginForm>({ username: 'cashier', password: 'cashier123' });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(loginForm);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4 relative overflow-hidden select-none">
      {/* Glow elements in corners to look premium */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[420px] bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 p-8 rounded-2xl shadow-2xl relative"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/20 mb-3">
            <Layers className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">SHOPOS</h1>
          <p className="text-xs text-neutral-400 mt-1">Enterprise POS & Inventory Platform</p>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">Username</label>
            <input 
              type="text"
              value={loginForm.username}
              onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">Password</label>
            <input 
              type="password"
              value={loginForm.password}
              onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
              required
            />
          </div>

          {authError && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-white hover:bg-neutral-200 text-neutral-950 text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Log In'}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-800"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-neutral-900 px-2 text-neutral-500">Developer Sandbox</span></div>
        </div>

        <button 
          type="button"
          onClick={handleQuickBypass}
          className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm py-2 rounded-lg transition-colors cursor-pointer border border-neutral-700/50"
        >
          Launch Offline Mock POS
        </button>

        <div className="mt-6 text-center text-xs text-neutral-500">
          <p>Seeded accounts: <strong className="text-neutral-300">cashier</strong> (3333) | <strong className="text-neutral-300">manager</strong> (2222)</p>
        </div>
      </motion.div>
    </div>
  );
}
