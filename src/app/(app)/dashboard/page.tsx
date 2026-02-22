'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth } from '@/providers/AuthProvider';
import { useRoutines } from '@/lib/hooks/useRoutines';
import { useUIStore } from '@/lib/stores/uiStore';
import { getActiveWorkout, deleteWorkout, createArchiveEntry } from '@/lib/firebase/firestore';
import { RoutineCard } from '@/components/routines/RoutineCard';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import type { Workout } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';

export default function DashboardPage() {
  const { firebaseUser, profile } = useAuth();
  const { routines, loading } = useRoutines();
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [checkingWorkout, setCheckingWorkout] = useState(true);

  // Check for active/stale workouts
  useEffect(() => {
    if (!firebaseUser) return;
    const check = async () => {
      try {
        const workout = await getActiveWorkout(firebaseUser.uid);
        if (!workout) {
          setCheckingWorkout(false);
          return;
        }

        const lastActive = workout.last_active_timestamp?.toDate?.() || new Date();
        const minutesSince = (Date.now() - lastActive.getTime()) / 1000 / 60;

        if (minutesSince > 30) {
          // Auto-complete stale workout
          await createArchiveEntry(firebaseUser.uid, {
            workout_id: workout.id,
            routine_id: workout.routine_id,
            routine_name: workout.custom_name,
            custom_name: workout.custom_name,
            completed_at: Timestamp.now(),
            completion_type: 'auto_completed',
            total_duration_secs: 0,
            blocks_completed: [],
            modifications_applied: false,
            memory_media: [],
            memory_media_paths: [],
          });
          await deleteWorkout(firebaseUser.uid, workout.id);
          addToast('Your previous workout was saved', 'info');
        } else {
          setActiveWorkout(workout);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingWorkout(false);
      }
    };
    check();
  }, [firebaseUser, addToast]);

  const handleDiscardWorkout = async () => {
    if (!firebaseUser || !activeWorkout) return;
    await deleteWorkout(firebaseUser.uid, activeWorkout.id);
    setActiveWorkout(null);
    addToast('Workout discarded', 'info');
  };

  return (
    <div className="px-4 pt-6">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-xl font-bold">
          {profile?.name || 'Hey'}
        </h1>
      </div>

      {/* Active workout banner */}
      {activeWorkout && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-accent/10 border border-accent/30 rounded-xl"
        >
          <p className="text-sm font-medium mb-2">
            Continue {activeWorkout.custom_name}?
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="!py-2 !text-xs flex-1"
              onClick={() =>
                router.push(`/workout/${activeWorkout.routine_id}?resume=${activeWorkout.id}`)
              }
            >
              Continue
            </Button>
            <Button
              variant="ghost"
              className="!py-2 !text-xs"
              onClick={handleDiscardWorkout}
            >
              Discard
            </Button>
          </div>
        </motion.div>
      )}

      {/* Routines section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider">
          My Routines
        </h2>
      </div>

      {loading || checkingWorkout ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : routines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-fg-subtle">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-fg-muted mb-1">No routines yet</p>
            <p className="text-xs text-fg-subtle">Build your first workout routine</p>
          </div>
          <Button onClick={() => router.push('/routines/new')}>
            Create Routine
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {routines.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onClick={() => router.push(`/routines/${routine.id}`)}
            />
          ))}
          <Button
            variant="secondary"
            fullWidth
            onClick={() => router.push('/routines/new')}
            className="mt-4"
          >
            + New Routine
          </Button>
        </div>
      )}
    </div>
  );
}
