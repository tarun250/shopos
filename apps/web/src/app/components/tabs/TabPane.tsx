'use client';

import React from 'react';
import { motion } from 'framer-motion';

// Root element of every tab: the fade used by the <AnimatePresence mode="wait"> tab switcher in page.tsx.
// Render it as the outermost element of a tab and give the tab element a `key` in page.tsx.
export default function TabPane({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
