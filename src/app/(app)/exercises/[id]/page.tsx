'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useUIStore } from '@/lib/stores/uiStore';
import {
  getExercise,
  deleteExercise,
  getExerciseStats,
} from '@/lib/firebase/firestore';
import { ExerciseForm } from '@/components/exercises/ExerciseForm';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ChevronLeftIcon, RepeatIcon, TimerIcon, RefreshIcon } from '@/components/ui/Icons';
import {
  formatDateShort,
  formatDurationCompact,
  formatRelativeTime,
} from '@/lib/utils/formatters';
import { useExerciseMediaUrl } from '@/lib/hooks/useExerciseMediaUrl';
import { EXERCISE_TYPE_LABELS } from '@/lib/types';
import type { Exercise, UserExerciseStats } from '@/lib/types';

function ExerciseDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-bg-elevated" />
        <div className="h-5 w-32 bg-bg-elevated rounded" />
      </div>
      {/* Match actual video layout: px-4 pt-5, w-[70%] max-w-[196px] left-aligned */}
      <div className="px-4 pt-5">
        <div className="w-[70%] max-w-[196px]">
          <div className="aspect-[9/16] bg-bg-elevated rounded-xl" />
        </div>
      </div>
      <div className="px-4 pt-6 space-y-4">
        <div className="flex gap-2">
          <div className="h-7 w-20 bg-bg-elevated rounded-full" />
          <div className="h-7 w-16 bg-bg-elevated rounded-full" />
        </div>
        <div className="h-4 w-full bg-bg-elevated rounded" />
        <div className="h-4 w-3/4 bg-bg-elevated rounded" />
        <div className="flex gap-2 mt-4">
          <div className="h-7 w-14 bg-bg-elevated rounded-full" />
          <div className="h-7 w-14 bg-bg-elevated rounded-full" />
        </div>
      </div>
    </div>
  );
}

function ExerciseErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <p className="text-sm text-fg-muted mb-4">Failed to load exercise</p>
      <Button variant="secondary" onClick={onRetry} icon={<RefreshIcon size={18} />}>
        Try again
      </Button>
    </div>
  );
}

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const addToast = useUIStore((s) => s.addToast);

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [stats, setStats] = useState<UserExerciseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const mediaUrl = useExerciseMediaUrl(exercise);

  const fetchExercise = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    try {
      const data = await getExercise(id);
      setExercise(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchStats = useCallback(async () => {
    if (!firebaseUser || !id) return;
    try {
      const s = await getExerciseStats(firebaseUser.uid, id);
      setStats(s);
    } catch {
      // Stats are optional, ignore errors
    }
  }, [firebaseUser, id]);

  useEffect(() => {
    fetchExercise();
  }, [fetchExercise]);

  useEffect(() => {
    if (exercise) fetchStats();
  }, [exercise, fetchStats]);

  const handleDelete = async () => {
    if (!exercise) return;
    setDeleting(true);
    try {
      await deleteExercise(exercise.id);
      addToast('Exercise deleted', 'success');
      router.back();
    } catch {
      addToast('Failed to delete', 'error');
      setDeleting(false);
      return Promise.reject();
    }
  };

  const handleSaveSuccess = () => {
    setEditing(false);
    fetchExercise();
  };

  if (loading) {
    return <ExerciseDetailSkeleton />;
  }

  if (error || !exercise) {
    return (
      <div>
        <div className="flex items-center px-4 py-3 border-b border-border">
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1 text-fg-muted hover:text-foreground transition-colors"
            aria-label="Go back"
          >
            <ChevronLeftIcon />
          </button>
        </div>
        <ExerciseErrorState onRetry={fetchExercise} />
      </div>
    );
  }

  if (editing) {
    return (
      <div>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button
            onClick={() => setEditing(false)}
            className="p-1.5 -ml-1 text-fg-muted hover:text-foreground transition-colors"
            aria-label="Cancel edit"
          >
            <ChevronLeftIcon />
          </button>
          <h1 className="text-base font-semibold flex-1">Edit Exercise</h1>
        </div>
        <ExerciseForm
          exercise={exercise}
          onSuccess={handleSaveSuccess}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const isOwner = firebaseUser?.uid === exercise.author_id;
  const createdDate = exercise.createdAt?.toDate?.();
  const updatedDate = exercise.updatedAt?.toDate?.();
  const showUpdated =
    updatedDate &&
    createdDate &&
    updatedDate.getTime() - createdDate.getTime() > 60000;

  return (
    <div className="pb-8 overflow-x-visible">
      {/* Header – back, exercise name (small), Edit */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button
          onClick={() => router.back()}
          className="p-1.5 -ml-1 shrink-0 text-fg-muted hover:text-foreground transition-colors"
          aria-label="Go back"
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="text-sm font-medium text-fg-muted truncate flex-1 min-w-0">
          {exercise.name}
        </h1>
        {isOwner && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-accent font-medium shrink-0"
          >
            Edit
          </button>
        )}
      </div>

      {/* Media hero – video left-aligned, name floating over bottom */}
      <div className="relative overflow-x-visible px-4 pt-5">
        <div className="relative w-[70%] max-w-[196px] shrink-0">
          {/* Video card */}
          <div className="aspect-[9/16] rounded-xl overflow-hidden bg-bg-elevated border border-border">
            {mediaUrl ? (
              exercise.media_type === 'video' ? (
                <video
                  src={mediaUrl}
                  muted
                  loop
                  playsInline
                  autoPlay
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt={exercise.name}
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-fg-subtle">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="2" y="2" width="20" height="20" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            )}
          </div>
          {/* Floating name – bold, over bottom of video */}
          <div
            className="absolute bottom-0 left-0 right-0 pt-8 pb-2.5 px-3"
            aria-hidden
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent rounded-b-xl pointer-events-none" />
            <h2
              className="relative text-lg font-bold tracking-tight text-white leading-snug line-clamp-2"
              style={{
                textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.6)',
              }}
            >
              {exercise.name}
            </h2>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="px-4 pt-6 pb-4 space-y-5">
        {/* Type & meta row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-elevated text-xs font-medium text-fg-muted border border-border">
            {exercise.type === 'repeat' ? (
              <RepeatIcon size={14} />
            ) : (
              <TimerIcon size={14} />
            )}
            {EXERCISE_TYPE_LABELS[exercise.type]}
          </span>
          {exercise.type === 'repeat' && exercise.default_time_per_rep_secs && (
            <span className="text-xs text-fg-subtle">
              {exercise.default_time_per_rep_secs}s per rep
            </span>
          )}
          <span className="text-xs text-fg-subtle">
            {exercise.is_public ? 'Public' : 'Private'}
          </span>
        </div>

        {/* Metadata */}
        {(createdDate || showUpdated) && (
          <p className="text-xs text-fg-subtle leading-relaxed">
            {createdDate && `Created ${formatDateShort(createdDate)}`}
            {showUpdated && updatedDate && (
              <> · Updated {formatDateShort(updatedDate)}</>
            )}
          </p>
        )}

        {/* Your stats */}
        {stats && stats.completions > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
              Your stats
            </h3>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-foreground font-medium">
                Done {stats.completions}×
              </span>
              {stats.last_completed_at?.toDate?.() && (
                <span className="text-fg-muted">
                  Last {formatRelativeTime(stats.last_completed_at.toDate())}
                </span>
              )}
              {stats.total_actual_duration_secs > 0 && (
                <span className="text-fg-muted">
                  {formatDurationCompact(stats.total_actual_duration_secs)} total
                </span>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        {exercise.description ? (
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
              Description
            </h3>
            <p className="text-sm text-fg-muted leading-relaxed">
              {exercise.description}
            </p>
          </div>
        ) : null}

        {/* Tags */}
        {exercise.chips.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {exercise.chips.map((chip) => (
                <span
                  key={chip}
                  className="px-2.5 py-1 rounded-full bg-bg-elevated text-xs text-fg-muted border border-border"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions – owner only */}
        {isOwner && (
          <div className="pt-4">
            <Button
              variant="danger"
              fullWidth
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Exercise
            </Button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete exercise?"
        message="This cannot be undone. Routines using this exercise will keep a copy of its data."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
