'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { getUserRoutines, getRoutine } from '@/lib/firebase/firestore';
import type { Routine } from '@/lib/types';

export function useRoutines() {
  const { firebaseUser } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutines = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getUserRoutines(firebaseUser.uid);
      setRoutines(data);
    } catch (err) {
      setError('Failed to load routines');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    fetchRoutines();
  }, [fetchRoutines]);

  return { routines, loading, error, refetch: fetchRoutines };
}

export function useRoutine(routineId: string | undefined) {
  const { firebaseUser } = useAuth();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser || !routineId) return;
    setLoading(true);
    getRoutine(firebaseUser.uid, routineId)
      .then(setRoutine)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [firebaseUser, routineId]);

  return { routine, loading };
}
