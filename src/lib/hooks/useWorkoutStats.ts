'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { getArchiveEntries } from '@/lib/firebase/firestore';
import type { ArchiveEntry } from '@/lib/types';

export interface WorkoutStats {
  lastWorkoutDate: Date | null;
  daysSinceLastWorkout: number | null;
  currentStreak: number;
  totalWorkouts: number;
  lastRoutineId: string | null;
  lastRoutineName: string | null;
}

function calculateStreak(entries: ArchiveEntry[]): number {
  if (entries.length === 0) return 0;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get unique workout days (sorted descending)
  const workoutDays = new Set<string>();
  for (const entry of entries) {
    const date = entry.completed_at?.toDate?.() || new Date();
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    workoutDays.add(dayKey);
  }

  const sortedDays = Array.from(workoutDays)
    .map((key) => {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m, d);
    })
    .sort((a, b) => b.getTime() - a.getTime());

  if (sortedDays.length === 0) return 0;

  // Check if most recent workout was today or yesterday
  const mostRecentDay = sortedDays[0];
  const daysDiff = Math.floor(
    (today.getTime() - mostRecentDay.getTime()) / (1000 * 60 * 60 * 24)
  );

  // If last workout was more than 1 day ago, streak is broken
  if (daysDiff > 1) return 0;

  // Count consecutive days
  let streak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prevDay = sortedDays[i - 1];
    const currDay = sortedDays[i];
    const diff = Math.floor(
      (prevDay.getTime() - currDay.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export function useWorkoutStats() {
  const { firebaseUser } = useAuth();
  const [stats, setStats] = useState<WorkoutStats>({
    lastWorkoutDate: null,
    daysSinceLastWorkout: null,
    currentStreak: 0,
    totalWorkouts: 0,
    lastRoutineId: null,
    lastRoutineName: null,
  });
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);

  const fetchStats = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const archiveEntries = await getArchiveEntries(firebaseUser.uid);
      setEntries(archiveEntries);

      if (archiveEntries.length === 0) {
        setStats({
          lastWorkoutDate: null,
          daysSinceLastWorkout: null,
          currentStreak: 0,
          totalWorkouts: 0,
          lastRoutineId: null,
          lastRoutineName: null,
        });
      } else {
        const mostRecent = archiveEntries[0];
        const lastDate = mostRecent.completed_at?.toDate?.() || new Date();
        const now = new Date();
        const daysSince = Math.floor(
          (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        setStats({
          lastWorkoutDate: lastDate,
          daysSinceLastWorkout: daysSince,
          currentStreak: calculateStreak(archiveEntries),
          totalWorkouts: archiveEntries.length,
          lastRoutineId: mostRecent.routine_id,
          lastRoutineName: mostRecent.routine_name,
        });
      }
    } catch (err) {
      console.error('Failed to fetch workout stats:', err);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Helper to get last performed date for a specific routine
  const getLastPerformedForRoutine = useCallback(
    (routineId: string): Date | null => {
      const entry = entries.find((e) => e.routine_id === routineId);
      return entry?.completed_at?.toDate?.() || null;
    },
    [entries]
  );

  return { stats, loading, refetch: fetchStats, getLastPerformedForRoutine };
}
