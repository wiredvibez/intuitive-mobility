'use client';

import { useEffect, useState, useMemo } from 'react';
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

const GREETINGS = [
  '[Name], about fucking time.',
  '[Name] sweat is sexy',
  'Finally back are we?',
  '[Name], Abs look good on you!',
  "Happy to see you're done procrastinating",
  "[Name], Let's get down to moving",
  'Look good naked, [Name].',
  'Done being lazy?',
  'Sweat looks good, [Name].',
  'Lift heavy shit.',
  'The game of gains',
  'Time to get hot.',
  '[Name] have you stretched today?',
  '[Name] how are your adductors feeling?',
  'Make them stare, [Name].',
  'Stop stalling, start sweating.',
  '[Name], quit the bitching.',
  "Let's build that ass.",
  'Finally off the couch?',
  'Get your pump on.',
  'Bored of being soft?',
  "Let's get aggressively sweaty.",
  'Skip the excuses, [Name].',
  'Welcome back, slacker.',
  '[Name], time to suffer.',
  'Ready to look dangerous?',
  'Move your ass, [Name].',
];

export default function DashboardPage() {
  const { firebaseUser, profile } = useAuth();
  const { routines, loading } = useRoutines();
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [checkingWorkout, setCheckingWorkout] = useState(true);

  const greeting = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * GREETINGS.length);
    return GREETINGS[randomIndex];
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const check = async () => {
      try {
        const workout = await getActiveWorkout(firebaseUser.uid);
        if (!workout) {
          setCheckingWorkout(false);
          return;
        }

        // Validate workout has required data
        if (!workout.routine_id || !workout.custom_name) {
          console.warn('Invalid workout found, cleaning up:', workout.id);
          await deleteWorkout(firebaseUser.uid, workout.id);
          setCheckingWorkout(false);
          return;
        }

        const lastActive = workout.last_active_timestamp?.toDate?.() || new Date();
        const minutesSince = (Date.now() - lastActive.getTime()) / 1000 / 60;

        if (minutesSince > 30) {
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
    const workoutId = activeWorkout.id;
    setActiveWorkout(null);
    try {
      await deleteWorkout(firebaseUser.uid, workoutId);
      addToast('Workout discarded', 'info');
    } catch (err) {
      console.error('Failed to discard workout:', err);
      addToast('Failed to discard workout', 'error');
      setActiveWorkout(activeWorkout);
    }
  };

  return (
    <div className="px-4 pt-8 pb-4">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h1 className="font-display font-bold text-3xl leading-tight tracking-tight">
          {greeting.replace(/\[Name\]/g, profile?.name || 'Athlete')}
        </h1>
      </motion.div>

      {/* Active workout banner */}
      {activeWorkout && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-accent/10 border border-accent/25 rounded-2xl"
        >
          <p className="text-sm font-semibold mb-3">
            Resume{' '}
            <span className="text-accent">{activeWorkout.custom_name}</span>?
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

      {/* Routines section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-2xl">Routines</h2>
        {!loading && !checkingWorkout && routines.length > 0 && (
          <button
            onClick={() => router.push('/routines/new')}
            className="text-accent text-sm font-semibold hover:text-accent-hover transition-colors"
          >
            + New
          </button>
        )}
      </div>

      {loading || checkingWorkout ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : routines.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center justify-center py-16 text-center gap-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-bg-card flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-fg-subtle">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div>
            <p className="font-display font-bold text-xl mb-1">No routines yet</p>
            <p className="text-sm text-fg-muted">Build your first workout to get moving</p>
          </div>
          <Button onClick={() => router.push('/routines/new')}>
            Create Routine
          </Button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="space-y-2"
        >
          {routines.map((routine, i) => (
            <motion.div
              key={routine.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <RoutineCard
                routine={routine}
                onClick={() => router.push(`/routines/${routine.id}`)}
              />
            </motion.div>
          ))}
          <div className="pt-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => router.push('/routines/new')}
            >
              + New Routine
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
