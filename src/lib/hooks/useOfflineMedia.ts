'use client';

import { useState, useEffect, useCallback } from 'react';
import { offlineCacheManager } from '../offline/cacheManager';
import { useOnlineStatus } from './useOfflineStatus';

export function useOfflineMediaUrl(exerciseId: string | undefined): {
  url: string | null;
  loading: boolean;
} {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!exerciseId) {
      setUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let blobUrl: string | null = null;

    const loadCachedMedia = async () => {
      setLoading(true);
      try {
        const cachedUrl = await offlineCacheManager.getCachedMediaUrl(exerciseId);
        if (!cancelled) {
          blobUrl = cachedUrl;
          setUrl(cachedUrl);
        }
      } catch {
        if (!cancelled) {
          setUrl(null);
        }
      }
      if (!cancelled) {
        setLoading(false);
      }
    };

    loadCachedMedia();

    return () => {
      cancelled = true;
      if (blobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [exerciseId, isOnline]);

  return { url, loading };
}

export function useResolvedMediaUrl(
  exerciseId: string | undefined,
  onlineUrl: string | undefined
): string | null {
  const isOnline = useOnlineStatus();
  const { url: offlineUrl, loading } = useOfflineMediaUrl(exerciseId);

  if (isOnline && onlineUrl) {
    return onlineUrl;
  }

  if (!isOnline && offlineUrl) {
    return offlineUrl;
  }

  if (!loading && offlineUrl) {
    return offlineUrl;
  }

  return onlineUrl || null;
}
