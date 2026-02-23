'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useUIStore } from '@/lib/stores/uiStore';
import {
  getActiveWorkout,
  deleteWorkout,
  createArchiveEntry,
} from '@/lib/firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import type { Workout } from '../types';

export function useWorkoutSession() {
  const { firebaseUser } = useAuth();
  const addToast = useUIStore((s) => s.addToast);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [checked, setChecked] = useState(false);

  const checkSession = useCallback(async () => {
    if (!firebaseUser) {
      setChecked(true);
      return;
    }

    try {
      const workout = await getActiveWorkout(firebaseUser.uid);
      if (!workout) {
        setChecked(true);
        return;
      }

      const lastActive = workout.last_active_timestamp?.toDate?.() || new Date();
      const minutesSince = (Date.now() - lastActive.getTime()) / 1000 / 60;

      if (minutesSince > 30) {
        // Auto-complete
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
      console.error('Session check failed:', err);
    } finally {
      setChecked(true);
    }
  }, [firebaseUser, addToast]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const discardWorkout = async () => {
    if (!firebaseUser || !activeWorkout) return;
    await deleteWorkout(firebaseUser.uid, activeWorkout.id);
    setActiveWorkout(null);
  };

  return { activeWorkout, checked, discardWorkout };
}
