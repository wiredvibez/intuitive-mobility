'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useRoutine } from '@/lib/hooks/useRoutines';
import { useUIStore } from '@/lib/stores/uiStore';
import { deleteRoutine } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatDuration, formatDurationCompact } from '@/lib/utils/formatters';
import type { RoutineBlock, ExerciseBlock, LoopBlock } from '@/lib/types';

function BlockListItem({ block, depth = 0 }: { block: RoutineBlock; depth?: number }) {
  const ml = depth > 0 ? 'ml-4' : '';

  if (block.type === 'exercise') {
    const ex = block as ExerciseBlock;
    return (
      <div className={`flex items-center gap-3 py-2 ${ml}`}>
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-bg-elevated shrink-0">
          {ex.media_url ? (
            ex.media_type === 'video' ? (
              <video src={ex.media_url} muted className="w-full h-full object-cover" />
            ) : (
              <img src={ex.media_url} alt="" className="w-full h-full object-cover" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-fg-subtle text-xs">🎬</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{ex.exercise_name}</p>
          <p className="text-xs text-fg-muted">
            {ex.reps ? `${ex.reps} reps · ` : ''}{formatDurationCompact(ex.duration_secs)}
          </p>
        </div>
      </div>
    );
  }

  if (block.type === 'break') {
    return (
      <div className={`flex items-center gap-3 py-2 ${ml}`}>
        <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-fg-subtle text-xs shrink-0">
          ⏸
        </div>
        <p className="text-sm text-fg-muted">Rest · {formatDurationCompact(block.duration_secs)}</p>
      </div>
    );
  }

  // Loop
  const loop = block as LoopBlock;
  return (
    <div className={`${ml} border-l-2 border-accent/30 pl-2 my-1`}>
      <p className="text-xs font-bold text-accent mb-1">LOOP {loop.iterations}×</p>
      {loop.blocks.map((b) => (
        <BlockListItem key={b.id} block={b} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function RoutineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const { routine, loading } = useRoutine(id);
  const addToast = useUIStore((s) => s.addToast);

  const handleDelete = async () => {
    if (!routine || !firebaseUser || !confirm('Delete this routine?')) return;
    try {
      await deleteRoutine(firebaseUser.uid, routine.id);
      addToast('Routine deleted', 'success');
      router.push('/dashboard');
    } catch {
      addToast('Failed to delete', 'error');
    }
  };

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
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={() => router.back()} className="p-1 text-fg-muted hover:text-foreground">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-base font-semibold truncate mx-3">{routine.name}</h1>
        <button
          onClick={() => router.push(`/routines/${routine.id}/edit`)}
          className="text-sm text-accent font-medium"
        >
          Edit
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 pb-32">
        {/* Duration */}
        <div className="flex items-center gap-4 mb-4 text-sm text-fg-muted">
          <span>{formatDuration(routine.total_duration_secs)}</span>
          <span className="text-fg-subtle">·</span>
          <span>{routine.blocks.length} blocks</span>
        </div>

        {/* Block list */}
        <div className="space-y-0 divide-y divide-border">
          {/* Prep */}
          {routine.prep_time_secs > 0 && (
            <div className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-xs shrink-0">▶</div>
              <p className="text-sm text-fg-muted">Prep · {formatDurationCompact(routine.prep_time_secs)}</p>
            </div>
          )}

          {routine.blocks.map((block) => (
            <BlockListItem key={block.id} block={block} />
          ))}

          {/* Cooldown */}
          {routine.cooldown_time_secs > 0 && (
            <div className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-xs shrink-0">■</div>
              <p className="text-sm text-fg-muted">Cooldown · {formatDurationCompact(routine.cooldown_time_secs)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom actions - positioned above BottomNav (h-14) */}
      <div className="fixed left-0 right-0 bg-bg-card/95 backdrop-blur-md border-t border-border p-4 z-30 bottom-14 pb-safe-b">
        <div className="max-w-app mx-auto space-y-2">
          <Button fullWidth onClick={() => router.push(`/workout/${routine.id}`)}>
            Start Workout
          </Button>
          <Button variant="danger" fullWidth onClick={handleDelete} className="!bg-transparent !border-0">
            Delete Routine
          </Button>
        </div>
      </div>
    </div>
  );
}
