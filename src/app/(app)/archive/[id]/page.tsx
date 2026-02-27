'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth } from '@/providers/AuthProvider';
import { getArchiveEntry } from '@/lib/firebase/firestore';
import { Spinner } from '@/components/ui/Spinner';
import { BlocksList } from '@/components/summary/BlocksList';
import { ChevronLeftIcon } from '@/components/ui/Icons';
import { formatDuration } from '@/lib/utils/formatters';
import type { ArchiveEntry } from '@/lib/types';

export default function ArchiveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [entry, setEntry] = useState<ArchiveEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser || !id) return;
    getArchiveEntry(firebaseUser.uid, id)
      .then(setEntry)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [firebaseUser, id]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-bg-card flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-fg-subtle">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <div>
          <p className="font-display font-bold text-xl mb-1">Workout not found</p>
          <p className="text-sm text-fg-muted">This workout may have been deleted</p>
        </div>
      </div>
    );
  }

  const date = entry.completed_at?.toDate?.() || new Date();
  const completedCount = entry.blocks_completed.filter((b) => !b.skipped).length;
  const totalCount = entry.blocks_completed.length;

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button
          onClick={() => router.back()}
          className="p-1.5 -ml-1 shrink-0 text-fg-muted hover:text-foreground transition-colors"
          aria-label="Go back"
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="text-sm font-medium text-fg-muted truncate flex-1 min-w-0">
          {entry.custom_name || entry.routine_name}
        </h1>
      </div>

      <div className="px-4 pt-5 space-y-6">
        {/* Title & Date */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h2 className="font-display font-bold text-2xl leading-tight mb-2">
            {entry.custom_name || entry.routine_name}
          </h2>
          <p className="text-sm text-fg-muted">
            {date.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
            <span className="text-fg-subtle"> at </span>
            {date.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="flex gap-3"
        >
          <div className="flex-1 bg-bg-card rounded-xl p-4 border border-border">
            <p className="font-display font-bold text-2xl">{formatDuration(entry.total_duration_secs)}</p>
            <p className="text-xs text-fg-muted mt-0.5">Duration</p>
          </div>
          <div className="flex-1 bg-bg-card rounded-xl p-4 border border-border">
            <p className="font-display font-bold text-2xl">
              {completedCount}<span className="text-fg-subtle font-normal">/{totalCount}</span>
            </p>
            <p className="text-xs text-fg-muted mt-0.5">Blocks completed</p>
          </div>
        </motion.div>

        {/* Completion type badge */}
        {entry.completion_type === 'auto_completed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-amber-400/10 text-amber-400 text-xs font-medium px-4 py-2.5 rounded-xl text-center border border-amber-400/20"
          >
            This workout was auto-saved after being inactive
          </motion.div>
        )}

        {/* Memory media */}
        {entry.memory_media.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">
              Memories
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {entry.memory_media.map((media, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-bg-elevated border border-border">
                  {media.type === 'video' ? (
                    <video
                      src={media.url}
                      muted
                      loop
                      playsInline
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={media.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Blocks list */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <BlocksList blocks={entry.blocks_completed} />
        </motion.div>
      </div>
    </div>
  );
}
