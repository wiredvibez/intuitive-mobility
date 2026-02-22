'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
    <div className="px-4 pt-4">
      <h1 className="text-lg font-bold mb-4">Workout History</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-fg-subtle">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-fg-muted mb-1">No workouts yet</p>
            <p className="text-xs text-fg-subtle">Complete a workout to see it here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const date = entry.completed_at?.toDate?.() || new Date();
            const completedCount = entry.blocks_completed.filter((b) => !b.skipped).length;
            const totalCount = entry.blocks_completed.length;

            return (
              <button
                key={entry.id}
                onClick={() => router.push(`/archive/${entry.id}`)}
                className="w-full text-left bg-bg-card border border-border rounded-xl p-4 transition-colors hover:border-fg-subtle"
              >
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-sm font-semibold truncate flex-1">
                    {entry.custom_name || entry.routine_name}
                  </h3>
                  <span className="text-xs text-fg-subtle ml-2 shrink-0">
                    {formatRelativeTime(date)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-fg-muted">
                  <span>{formatDuration(entry.total_duration_secs)}</span>
                  <span className="text-fg-subtle">·</span>
                  <span>{completedCount}/{totalCount} blocks</span>
                  {entry.completion_type === 'auto_completed' && (
                    <>
                      <span className="text-fg-subtle">·</span>
                      <span className="text-amber-400">Auto-saved</span>
                    </>
                  )}
                  {entry.memory_media.length > 0 && (
                    <>
                      <span className="text-fg-subtle">·</span>
                      <span>📷 {entry.memory_media.length}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
