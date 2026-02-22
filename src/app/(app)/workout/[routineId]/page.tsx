'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useUIStore } from '@/lib/stores/uiStore';
import { getRoutine, createWorkout, getActiveWorkout } from '@/lib/firebase/firestore';
import { usePlayerStore, flattenBlocks } from '@/lib/stores/playerStore';
import { WorkoutPlayer } from '@/components/player/WorkoutPlayer';
import { Spinner } from '@/components/ui/Spinner';
import { Timestamp } from 'firebase/firestore';
import type { Routine } from '@/lib/types';

export default function WorkoutPage() {
  const { routineId } = useParams<{ routineId: string }>();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get('resume');

  const { firebaseUser } = useAuth();
  const addToast = useUIStore((s) => s.addToast);
  const initPlayer = usePlayerStore((s) => s.initPlayer);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseUser || !routineId) return;

    const init = async () => {
      try {
        // Load routine
        const routine = await getRoutine(firebaseUser.uid, routineId);
        if (!routine) {
          setError('Routine not found');
          setLoading(false);
          return;
        }

        // Flatten blocks
        const flatBlocks = flattenBlocks(
          routine.blocks,
          routine.prep_time_secs,
          routine.cooldown_time_secs
        );

        if (resumeId) {
          // Resume existing workout
          const workout = await getActiveWorkout(firebaseUser.uid);
          if (workout && workout.id === resumeId) {
            initPlayer({
              blocks: flatBlocks,
              workoutId: workout.id,
              routineId: routine.id,
              routineName: routine.name,
              startIndex: workout.progress_index,
              startRemaining: workout.current_block_remaining_secs,
            });
          } else {
            // Create new workout
            const workoutId = await createNewWorkout(routine);
            initPlayer({
              blocks: flatBlocks,
              workoutId,
              routineId: routine.id,
              routineName: routine.name,
            });
          }
        } else {
          // Create new workout
          const workoutId = await createNewWorkout(routine);
          initPlayer({
            blocks: flatBlocks,
            workoutId,
            routineId: routine.id,
            routineName: routine.name,
          });
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to init workout:', err);
        setError('Failed to start workout');
        setLoading(false);
      }
    };

    const createNewWorkout = async (routine: Routine) => {
      return createWorkout(firebaseUser!.uid, {
        routine_id: routine.id,
        custom_name: routine.name,
        state: 'active',
        last_active_timestamp: Timestamp.now(),
        progress_index: 0,
        current_block_remaining_secs: 0,
        modifications: [],
        skipped_blocks: [],
      });
    };

    init();
  }, [firebaseUser, routineId, resumeId, initPlayer, addToast]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Spinner size={32} />
          <p className="text-sm text-fg-muted">Loading workout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  return <WorkoutPlayer />;
}
