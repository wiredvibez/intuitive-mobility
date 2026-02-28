'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useMotionValue, useTransform, PanInfo } from 'motion/react';
import { useAuth } from '@/providers/AuthProvider';
import { useRoutines } from '@/lib/hooks/useRoutines';
import { useWorkoutStats } from '@/lib/hooks/useWorkoutStats';
import { usePinnedRoutines } from '@/lib/hooks/usePinnedRoutines';
import { useUIStore } from '@/lib/stores/uiStore';
import { getActiveWorkout, deleteWorkout, createArchiveEntry } from '@/lib/firebase/firestore';
import { RoutineCard } from '@/components/routines/RoutineCard';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  formatDaysSince,
  formatStreak,
  getTimeOfDayGreeting,
} from '@/lib/utils/formatters';
import type { Workout } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';

const GREETINGS_BY_TIME = {
  morning: [
    'Rise and stretch, [Name].',
    'Good morning, [Name].',
    'Morning moves, [Name].',
    '[Name], early bird gets gains.',
    'Start the day right, [Name].',
    'Morning mobility, [Name]?',
  ],
  afternoon: [
    'Afternoon, [Name].',
    '[Name], midday movement?',
    'Break time, [Name].',
    'Stretch it out, [Name].',
    '[Name], shake off the slump.',
    'Move that body, [Name].',
  ],
  evening: [
    'Evening, [Name].',
    '[Name], wind down with movement.',
    'Unwind time, [Name].',
    '[Name], stretch before rest.',
    'End the day strong, [Name].',
    'Evening mobility, [Name]?',
  ],
  night: [
    '[Name], late night session?',
    'Night owl, [Name]?',
    '[Name], can\'t sleep either?',
    'Midnight moves, [Name].',
    'Late stretch, [Name]?',
    '[Name], burning the midnight oil.',
  ],
};

const PULL_THRESHOLD = 80;

export default function DashboardPage() {
  const { firebaseUser, profile } = useAuth();
  const { routines, loading, refetch: refetchRoutines } = useRoutines();
  const { stats, loading: statsLoading, refetch: refetchStats, getLastPerformedForRoutine } = useWorkoutStats();
  const { isPinned, togglePin, canPin } = usePinnedRoutines();
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [checkingWorkout, setCheckingWorkout] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pull to refresh
  const pullY = useMotionValue(0);
  const pullOpacity = useTransform(pullY, [0, PULL_THRESHOLD], [0, 1]);
  const pullRotate = useTransform(pullY, [0, PULL_THRESHOLD], [0, 180]);

  const handlePullEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      await Promise.all([refetchRoutines(), refetchStats()]);
      setIsRefreshing(false);
      addToast('Refreshed', 'info');
    }
  };

  // Time-aware greeting
  const greeting = useMemo(() => {
    const timeOfDay = getTimeOfDayGreeting();
    const greetings = GREETINGS_BY_TIME[timeOfDay];
    const randomIndex = Math.floor(Math.random() * greetings.length);
    return greetings[randomIndex];
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

  // Sort routines: pinned first, then by updatedAt
  const sortedRoutines = useMemo(() => {
    return [...routines].sort((a, b) => {
      const aPinned = isPinned(a.id);
      const bPinned = isPinned(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [routines, isPinned]);

  // Streak/time since message
  const statusMessage = useMemo(() => {
    if (statsLoading || stats.lastWorkoutDate === null) return null;

    if (stats.currentStreak >= 2) {
      return {
        text: formatStreak(stats.currentStreak),
        icon: '🔥',
        accent: true,
      };
    }

    if (stats.daysSinceLastWorkout !== null) {
      return {
        text: `Last workout ${formatDaysSince(stats.daysSinceLastWorkout)}`,
        icon: null,
        accent: false,
      };
    }

    return null;
  }, [stats, statsLoading]);

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.5, bottom: 0 }}
      onDragEnd={handlePullEnd}
      style={{ y: pullY }}
      className="px-4 pt-8 pb-4 min-h-screen"
    >
      {/* Pull to refresh indicator */}
      <motion.div
        className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center justify-center"
        style={{ opacity: pullOpacity }}
      >
        <motion.div style={{ rotate: pullRotate }}>
          {isRefreshing ? (
            <Spinner size={20} />
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-fg-muted"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          )}
        </motion.div>
      </motion.div>

      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-2"
      >
        <h1 className="font-display font-bold text-3xl leading-tight tracking-tight">
          {greeting.replace(/\[Name\]/g, profile?.name || 'Athlete')}
        </h1>
      </motion.div>

      {/* Status message (streak or time since) */}
      {statusMessage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <p className={`text-sm ${statusMessage.accent ? 'text-accent font-semibold' : 'text-fg-muted'}`}>
            {statusMessage.icon && <span className="mr-1">{statusMessage.icon}</span>}
            {statusMessage.text}
          </p>
        </motion.div>
      )}

      {/* Spacer if no status message */}
      {!statusMessage && <div className="mb-6" />}

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
          className="flex flex-col items-center justify-center py-20 text-center gap-6"
        >
          {/* Welcoming illustration */}
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-accent"
              >
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M5 8H4a4 4 0 0 0 0 8h1" />
                <path d="M6 8h12v9a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
                <line x1="18" y1="1" x2="18" y2="4" />
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-accent-fg">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-display font-bold text-2xl">Welcome to your space</h3>
            <p className="text-sm text-fg-muted max-w-[260px] leading-relaxed">
              Build your first routine and start your mobility journey. We&apos;ll keep track of your progress.
            </p>
          </div>

          <Button onClick={() => router.push('/routines/new')} className="px-8">
            Create Your First Routine
          </Button>

          <p className="text-xs text-fg-subtle">
            Or head to{' '}
            <button
              onClick={() => router.push('/exercises')}
              className="text-accent hover:underline"
            >
              Exercises
            </button>
            {' '}to build your library first
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="space-y-2"
        >
          {sortedRoutines.map((routine, i) => (
            <motion.div
              key={routine.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <RoutineCard
                routine={routine}
                onClick={() => router.push(`/routines/${routine.id}`)}
                isPinned={isPinned(routine.id)}
                canPin={canPin}
                onTogglePin={() => togglePin(routine.id)}
                lastPerformed={getLastPerformedForRoutine(routine.id)}
                onSwipeStart={() => router.push(`/workout/${routine.id}`)}
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
    </motion.div>
  );
}
