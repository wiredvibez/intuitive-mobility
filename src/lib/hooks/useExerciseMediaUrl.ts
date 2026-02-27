'use client';

import { useState, useEffect } from 'react';
import { getDownloadURL } from '@/lib/firebase/storage';
import type { Exercise } from '@/lib/types';

/** Resolves media_url, using media_storage_path when media_url is empty (imported exercises) */
export function useExerciseMediaUrl(exercise: Exercise | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!exercise) {
      setUrl(null);
      return;
    }
    if (exercise.media_url) {
      setUrl(exercise.media_url);
      return;
    }
    if (exercise.media_storage_path) {
      getDownloadURL(exercise.media_storage_path)
        .then(setUrl)
        .catch(() => setUrl(null));
      return;
    }
    setUrl(null);
  }, [exercise]);

  return url;
}
