'use client';

import { useParams, useRouter } from 'next/navigation';
import { useRoutine } from '@/lib/hooks/useRoutines';
import { RoutineBuilder } from '@/components/routines/RoutineBuilder';
import { Spinner } from '@/components/ui/Spinner';

export default function EditRoutinePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { routine, loading } = useRoutine(id);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!routine) {
    return <div className="text-center py-12 text-fg-muted">Routine not found</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button
          onClick={() => router.back()}
          className="p-1 text-fg-muted hover:text-foreground"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-base font-semibold">Edit Routine</h1>
      </div>

      <RoutineBuilder routine={routine} />
    </div>
  );
}
