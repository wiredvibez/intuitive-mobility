'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { getArchiveEntry } from '@/lib/firebase/firestore';
import { Spinner } from '@/components/ui/Spinner';
import { BlocksList } from '@/components/summary/BlocksList';
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
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!entry) {
    return <div className="text-center py-12 text-fg-muted">Workout not found</div>;
  }

  const date = entry.completed_at?.toDate?.() || new Date();

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={() => router.back()} className="p-1 text-fg-muted hover:text-foreground">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-base font-semibold truncate">
          {entry.custom_name || entry.routine_name}
        </h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Date & Info */}
        <div className="space-y-1">
          <p className="text-sm text-fg-muted">
            {date.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <p className="text-xs text-fg-subtle">
            {date.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <div className="flex-1 bg-bg-card rounded-xl p-3 border border-border text-center">
            <p className="text-lg font-bold">{formatDuration(entry.total_duration_secs)}</p>
            <p className="text-xs text-fg-muted">Duration</p>
          </div>
          <div className="flex-1 bg-bg-card rounded-xl p-3 border border-border text-center">
            <p className="text-lg font-bold">
              {entry.blocks_completed.filter((b) => !b.skipped).length}/
              {entry.blocks_completed.length}
            </p>
            <p className="text-xs text-fg-muted">Blocks</p>
          </div>
        </div>

        {/* Completion type badge */}
        {entry.completion_type === 'auto_completed' && (
          <div className="bg-amber-400/10 text-amber-400 text-xs font-medium px-3 py-2 rounded-lg text-center">
            This workout was auto-saved after being inactive for 30+ minutes
          </div>
        )}

        {/* Memory media */}
        {entry.memory_media.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
              Memories
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {entry.memory_media.map((media, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-bg-elevated">
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
          </div>
        )}

        {/* Blocks list */}
        <BlocksList blocks={entry.blocks_completed} />
      </div>
    </div>
  );
}
