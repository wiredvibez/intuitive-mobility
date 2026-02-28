'use client';

import { useEffect, useState, createContext, useContext, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './AuthProvider';
import { offlineCacheManager } from '@/lib/offline/cacheManager';
import { processSyncQueue } from '@/lib/db/syncQueue';
import { useOnlineStatus } from '@/lib/hooks/useOfflineStatus';

interface OfflineContextValue {
  isOnline: boolean;
}

const OfflineContext = createContext<OfflineContextValue>({ isOnline: true });

export function useOfflineContext() {
  return useContext(OfflineContext);
}

interface OfflineProviderProps {
  children: ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const { firebaseUser } = useAuth();
  const isOnline = useOnlineStatus();
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Run cleanup on mount (when online)
  useEffect(() => {
    if (!isOnline) return;

    const runCleanup = async () => {
      try {
        const enabled = await offlineCacheManager.isEnabled();
        if (enabled) {
          await offlineCacheManager.cleanupExpired();
        }
      } catch (err) {
        console.error('Cache cleanup failed:', err);
      }
    };

    runCleanup();
  }, [isOnline]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && wasOffline && firebaseUser) {
      processSyncQueue(firebaseUser.uid).catch(console.error);
    }
    setWasOffline(!isOnline);
  }, [isOnline, wasOffline, firebaseUser]);

  // Show/hide offline banner
  useEffect(() => {
    if (!isOnline) {
      setShowOfflineBanner(true);
    } else {
      // Delay hiding to show "Back online" message
      const timer = setTimeout(() => {
        setShowOfflineBanner(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  // Listen for service worker sync requests
  useEffect(() => {
    const handleSync = (event: CustomEvent) => {
      if (firebaseUser && event.detail) {
        processSyncQueue(firebaseUser.uid).catch(console.error);
      }
    };

    window.addEventListener('sw-sync', handleSync as EventListener);
    return () => {
      window.removeEventListener('sw-sync', handleSync as EventListener);
    };
  }, [firebaseUser]);

  return (
    <OfflineContext.Provider value={{ isOnline }}>
      {children}

      {/* Offline Banner */}
      <AnimatePresence>
        {showOfflineBanner && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 left-0 right-0 z-[100] pt-safe-t"
          >
            <div
              className={`
                max-w-app mx-auto px-4 py-2 text-center text-sm font-medium
                ${isOnline ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'}
              `}
            >
              {isOnline ? (
                'Back online'
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                  </svg>
                  <span>You&apos;re offline — using cached data</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </OfflineContext.Provider>
  );
}
