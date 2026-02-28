'use client';

import { useState, useEffect, useCallback } from 'react';
import { offlineCacheManager } from '../offline/cacheManager';
import type { CachedRoutine } from '../db/dexie';

export function useOfflineEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    offlineCacheManager.isEnabled().then((val) => {
      setEnabled(val);
      setLoading(false);
    });
  }, []);

  const toggle = useCallback(async (value: boolean) => {
    setLoading(true);
    await offlineCacheManager.setEnabled(value);
    setEnabled(value);
    setLoading(false);
  }, []);

  return { enabled, loading, toggle };
}

export function useCachedRoutines(userId: string | undefined) {
  const [routines, setRoutines] = useState<CachedRoutine[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const data = await offlineCacheManager.getAllCachedRoutines(userId);
    setRoutines(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const removeRoutine = useCallback(
    async (routineId: string) => {
      await offlineCacheManager.uncacheRoutine(routineId);
      await refetch();
    },
    [refetch]
  );

  const pinRoutine = useCallback(
    async (routineId: string, pinned: boolean) => {
      await offlineCacheManager.pinRoutine(routineId, pinned);
      await refetch();
    },
    [refetch]
  );

  return { routines, loading, refetch, removeRoutine, pinRoutine };
}

export function useRoutineCacheStatus(routineId: string | undefined) {
  const [cached, setCached] = useState<CachedRoutine | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!routineId) {
      setCached(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await offlineCacheManager.getCachedRoutine(routineId);
    setCached(data);
    setLoading(false);
  }, [routineId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { cached, loading, refetch };
}

export function useOfflineStorageUsed() {
  const [bytes, setBytes] = useState(0);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const total = await offlineCacheManager.getTotalStorageUsed();
    setBytes(total);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { bytes, loading, refetch };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i > 1 ? 1 : 0)} ${sizes[i]}`;
}
