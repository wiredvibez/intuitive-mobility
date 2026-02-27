'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth } from '@/providers/AuthProvider';
import { getArchiveEntries } from '@/lib/firebase/firestore';
import { Spinner } from '@/components/ui/Spinner';
import { formatDuration, formatRelativeTime } from '@/lib/utils/formatters';
import type { ArchiveEntry } from '@/lib/types';

export default function ArchivePage() {
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;
    getArchiveEntries(firebaseUser.uid)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [firebaseUser]);

  return (
    <div className="px-4 pt-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <h1 className="font-display font-bold text-5xl leading-none tracking-tight">
          History
        </h1>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center justify-center py-16 text-center gap-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-bg-card flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-fg-subtle">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="font-display font-bold text-xl mb-1">No workouts yet</p>
            <p className="text-sm text-fg-muted">Complete a workout to see it here</p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="space-y-2"
        >
          {entries.map((entry, i) => {
            const date = entry.completed_at?.toDate?.() || new Date();
            const completedCount = entry.blocks_completed.filter((b) => !b.skipped).length;
            const totalCount = entry.blocks_completed.length;

            return (
              <motion.button
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => router.push(`/archive/${entry.id}`)}
                className="w-full text-left bg-bg-card border border-border rounded-xl p-4 transition-colors hover:border-fg-subtle active:scale-[0.98]"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <h3 className="text-sm font-semibold truncate flex-1">
                    {entry.custom_name || entry.routine_name}
                  </h3>
                  <span className="text-xs text-fg-subtle ml-2 shrink-0">
                    {formatRelativeTime(date)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-fg-muted flex-wrap">
                  <span className="font-medium">{formatDuration(entry.total_duration_secs)}</span>
                  <span className="text-fg-subtle">·</span>
                  <span>{completedCount}/{totalCount} blocks</span>
                  {entry.completion_type === 'auto_completed' && (
                    <>
                      <span className="text-fg-subtle">·</span>
                      <span className="text-amber-400 font-medium">Auto-saved</span>
                    </>
                  )}
                  {entry.memory_media.length > 0 && (
                    <>
                      <span className="text-fg-subtle">·</span>
                      <span className="flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-fg-subtle">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                        {entry.memory_media.length}
                      </span>
                    </>
                  )}
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
