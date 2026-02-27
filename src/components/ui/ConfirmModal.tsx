'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { Button } from './Button';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch {
      // Don't close on error – let user retry
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-50 max-w-app mx-auto"
          >
            <div className="bg-bg-card rounded-2xl p-5 shadow-xl border border-border">
              <h3 className="text-base font-semibold text-foreground mb-1">
                {title}
              </h3>
              {message && (
                <p className="text-sm text-fg-muted mb-5">{message}</p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={onClose}
                  disabled={loading}
                >
                  {cancelLabel}
                </Button>
                <Button
                  variant={variant}
                  className="flex-1"
                  onClick={handleConfirm}
                  loading={loading}
                >
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
