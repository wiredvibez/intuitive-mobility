'use client';

import { useUIStore } from '@/lib/stores/uiStore';
import { AnimatePresence, motion } from 'motion/react';

export function ToastProvider() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div className="fixed bottom-20 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={() => removeToast(toast.id)}
            className={`
              pointer-events-auto cursor-pointer rounded-xl px-4 py-2.5
              text-sm font-medium shadow-lg backdrop-blur-sm
              ${toast.type === 'success' ? 'bg-success/90 text-white' : ''}
              ${toast.type === 'error' ? 'bg-danger/90 text-white' : ''}
              ${toast.type === 'info' ? 'bg-bg-elevated/90 text-foreground border border-border' : ''}
            `}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
