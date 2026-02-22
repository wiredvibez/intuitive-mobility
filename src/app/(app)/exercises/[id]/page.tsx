'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useUIStore } from '@/lib/stores/uiStore';
import { getExercise, deleteExercise } from '@/lib/firebase/firestore';
import { ExerciseForm } from '@/components/exercises/ExerciseForm';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
// formatDurationCompact available if needed
import type { Exercise } from '@/lib/types';

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const addToast = useUIStore((s) => s.addToast);

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getExercise(id)
      .then(setExercise)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!exercise || !confirm('Delete this exercise?')) return;
    setDeleting(true);
    try {
      await deleteExercise(exercise.id);
      addToast('Exercise deleted', 'success');
      router.back();
    } catch {
      addToast('Failed to delete', 'error');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="text-center py-12 text-fg-muted">Exercise not found</div>
    );
  }

  if (editing) {
    return (
      <div>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button onClick={() => setEditing(false)} className="p-1 text-fg-muted hover:text-foreground">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="text-base font-semibold">Edit Exercise</h1>
        </div>
        <ExerciseForm exercise={exercise} />
      </div>
    );
  }

  const isOwner = firebaseUser?.uid === exercise.author_id;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={() => router.back()} className="p-1 text-fg-muted hover:text-foreground">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-base font-semibold truncate mx-3">{exercise.name}</h1>
        {isOwner && (
          <button onClick={() => setEditing(true)} className="text-sm text-accent font-medium">
            Edit
          </button>
        )}
      </div>

      {/* Media */}
      <div className="aspect-video bg-bg-elevated">
        {exercise.media_type === 'video' ? (
          <video
            src={exercise.media_url}
            muted
            loop
            playsInline
            autoPlay
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={exercise.media_url}
            alt={exercise.name}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Details */}
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-bg-elevated text-xs font-medium text-fg-muted border border-border">
            {exercise.type === 'repeat' ? '⟳ Repeat' : '⏱ Timed'}
          </span>
          {exercise.type === 'repeat' && exercise.default_time_per_rep_secs && (
            <span className="text-xs text-fg-subtle">
              {exercise.default_time_per_rep_secs}s/rep
            </span>
          )}
          <span className="text-xs text-fg-subtle">
            {exercise.is_public ? 'Public' : 'Private'}
          </span>
        </div>

        {exercise.description && (
          <p className="text-sm text-fg-muted leading-relaxed">
            {exercise.description}
          </p>
        )}

        {exercise.chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {exercise.chips.map((chip) => (
              <span
                key={chip}
                className="px-2.5 py-1 rounded-full bg-bg-elevated text-xs text-fg-muted border border-border"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {isOwner && (
          <Button
            variant="danger"
            fullWidth
            onClick={handleDelete}
            loading={deleting}
          >
            Delete Exercise
          </Button>
        )}
      </div>
    </div>
  );
}
