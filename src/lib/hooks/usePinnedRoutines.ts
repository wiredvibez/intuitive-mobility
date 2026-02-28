'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pinned_routines';
const MAX_PINNED = 3;

export function usePinnedRoutines() {
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPinnedIds(parsed.slice(0, MAX_PINNED));
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save to localStorage whenever pinnedIds changes
  const savePinned = useCallback((ids: string[]) => {
    setPinnedIds(ids);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const isPinned = useCallback(
    (routineId: string) => pinnedIds.includes(routineId),
    [pinnedIds]
  );

  const togglePin = useCallback(
    (routineId: string) => {
      if (pinnedIds.includes(routineId)) {
        // Unpin
        savePinned(pinnedIds.filter((id) => id !== routineId));
      } else {
        // Pin (if under max limit)
        if (pinnedIds.length < MAX_PINNED) {
          savePinned([routineId, ...pinnedIds]);
        }
      }
    },
    [pinnedIds, savePinned]
  );

  const canPin = pinnedIds.length < MAX_PINNED;

  return { pinnedIds, isPinned, togglePin, canPin, maxPinned: MAX_PINNED };
}
