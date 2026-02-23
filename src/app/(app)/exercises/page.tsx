'use client';

import { useRouter } from 'next/navigation';
import { useExercises } from '@/lib/hooks/useExercises';
import { ExerciseCard } from '@/components/exercises/ExerciseCard';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { Exercise } from '@/lib/types';

export default function ExercisesPage() {
  const router = useRouter();
  const { exercises, loading } = useExercises(true);

  const handleSelect = (exercise: Exercise) => {
    router.push(`/exercises/${exercise.id}`);
  };

  return (
    <div className="px-4 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">My Exercises</h1>
        <Button
          variant="secondary"
          onClick={() => router.push('/exercises/new')}
          className="!py-2 !px-3 !text-xs"
        >
          + New
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : exercises.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-fg-subtle">
              <path d="M6.5 6.5h11M6.5 17.5h11" />
              <rect x="2" y="8.5" width="4" height="7" rx="1" />
              <rect x="18" y="8.5" width="4" height="7" rx="1" />
              <line x1="12" y1="6.5" x2="12" y2="17.5" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-fg-muted mb-1">No exercises yet</p>
            <p className="text-xs text-fg-subtle">Create your first exercise to get started</p>
          </div>
          <Button onClick={() => router.push('/exercises/new')}>
            Create Exercise
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              onSelect={handleSelect}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}
