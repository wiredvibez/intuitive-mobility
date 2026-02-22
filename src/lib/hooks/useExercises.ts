'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import {
  getAllAccessibleExercises,
  getUserExercises,
} from '@/lib/firebase/firestore';
import type { Exercise } from '@/lib/types';

export function useExercises(onlyMine = false) {
  const { firebaseUser } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExercises = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      const data = onlyMine
        ? await getUserExercises(firebaseUser.uid)
        : await getAllAccessibleExercises(firebaseUser.uid);
      setExercises(data);
    } catch (err) {
      setError('Failed to load exercises');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, onlyMine]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  return { exercises, loading, error, refetch: fetchExercises };
}

/** Client-side aggregate search across name, description, and chips */
export function searchExercises(
  exercises: Exercise[],
  query: string,
  activeChips: string[],
  myOnly: boolean,
  userId?: string
): Exercise[] {
  let filtered = exercises;

  // Filter by ownership
  if (myOnly && userId) {
    filtered = filtered.filter((ex) => ex.author_id === userId);
  }

  // Filter by active chips (AND logic)
  if (activeChips.length > 0) {
    filtered = filtered.filter((ex) =>
      activeChips.every((chip) =>
        ex.chips.some((c) => c.toLowerCase() === chip.toLowerCase())
      )
    );
  }

  // Filter by search query (AND logic per term)
  if (query.trim()) {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    filtered = filtered.filter((ex) =>
      terms.every((term) => {
        const inName = ex.name.toLowerCase().includes(term);
        const inDesc = ex.description.toLowerCase().includes(term);
        const inChips = ex.chips.some((c) =>
          c.toLowerCase().includes(term)
        );
        return inName || inDesc || inChips;
      })
    );
  }

  return filtered;
}
