import {
  appDb,
  getOfflineSettings,
  setOfflineEnabled,
  updateLastCleanup,
  type CachedRoutine,
  type CachedExercise,
  type CachedMedia,
} from '../db/dexie';
import { getDownloadURL } from '../firebase/storage';
import type { Routine, Exercise, ExerciseBlock, LoopBlock } from '../types';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function extractExerciseIds(routine: Routine): string[] {
  const ids = new Set<string>();

  function processBlocks(blocks: Routine['blocks']) {
    for (const block of blocks) {
      if (block.type === 'exercise') {
        ids.add((block as ExerciseBlock).exercise_id);
      } else if (block.type === 'loop') {
        processBlocks((block as LoopBlock).blocks);
      }
    }
  }

  processBlocks(routine.blocks);
  return Array.from(ids);
}

async function resolveMediaUrl(exercise: Exercise): Promise<string | null> {
  if (exercise.media_url) return exercise.media_url;
  if (exercise.media_storage_path) {
    try {
      return await getDownloadURL(exercise.media_storage_path);
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchVideoBlob(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

export const offlineCacheManager = {
  // ── Settings ───────────────────────────────────────────

  async isEnabled(): Promise<boolean> {
    const settings = await getOfflineSettings();
    return settings.enabled;
  },

  async setEnabled(enabled: boolean): Promise<void> {
    if (!enabled) {
      await this.clearAllOfflineData();
    }
    await setOfflineEnabled(enabled);
  },

  // ── Routine Caching ────────────────────────────────────

  async cacheRoutine(
    userId: string,
    routine: Routine,
    exercises: Exercise[],
    pin = false,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    const enabled = await this.isEnabled();
    if (!enabled) return;

    const exerciseIds = extractExerciseIds(routine);
    const relevantExercises = exercises.filter((e) =>
      exerciseIds.includes(e.id)
    );

    let totalSize = JSON.stringify(routine).length;
    let downloadedCount = 0;
    const totalToDownload = relevantExercises.length;

    // Cache routine metadata
    const existingRoutine = await appDb.cachedRoutines.get(routine.id);
    const now = Date.now();

    const cachedRoutine: CachedRoutine = {
      id: routine.id,
      userId,
      routine,
      exerciseIds,
      cachedAt: now,
      expiresAt: pin ? null : now + FOURTEEN_DAYS_MS,
      pinned: pin || existingRoutine?.pinned || false,
      sizeBytes: totalSize,
    };

    await appDb.cachedRoutines.put(cachedRoutine);

    // Cache exercises and their videos
    for (const exercise of relevantExercises) {
      await this.cacheExercise(exercise, routine.id);

      // Download video if not already cached
      const mediaUrl = await resolveMediaUrl(exercise);
      if (mediaUrl) {
        const existingMedia = await appDb.cachedMedia
          .where('exerciseId')
          .equals(exercise.id)
          .first();

        if (!existingMedia) {
          const blob = await fetchVideoBlob(mediaUrl);
          if (blob) {
            const mediaEntry: CachedMedia = {
              url: mediaUrl,
              exerciseId: exercise.id,
              blob,
              sizeBytes: blob.size,
              cachedAt: now,
            };
            await appDb.cachedMedia.add(mediaEntry);
            totalSize += blob.size;
          }
        } else {
          totalSize += existingMedia.sizeBytes;
        }
      }

      downloadedCount++;
      onProgress?.(downloadedCount, totalToDownload);
    }

    // Update routine size
    await appDb.cachedRoutines.update(routine.id, { sizeBytes: totalSize });
  },

  async cacheExercise(exercise: Exercise, routineId: string): Promise<void> {
    const existing = await appDb.cachedExercises.get(exercise.id);

    if (existing) {
      if (!existing.routineIds.includes(routineId)) {
        await appDb.cachedExercises.update(exercise.id, {
          exercise,
          routineIds: [...existing.routineIds, routineId],
          cachedAt: Date.now(),
        });
      }
    } else {
      const cachedExercise: CachedExercise = {
        id: exercise.id,
        exercise,
        routineIds: [routineId],
        cachedAt: Date.now(),
      };
      await appDb.cachedExercises.add(cachedExercise);
    }
  },

  async uncacheRoutine(routineId: string): Promise<void> {
    const routine = await appDb.cachedRoutines.get(routineId);
    if (!routine) return;

    // Remove routine
    await appDb.cachedRoutines.delete(routineId);

    // Check each exercise and remove if orphaned
    for (const exerciseId of routine.exerciseIds) {
      const exercise = await appDb.cachedExercises.get(exerciseId);
      if (!exercise) continue;

      const updatedRoutineIds = exercise.routineIds.filter(
        (id) => id !== routineId
      );

      if (updatedRoutineIds.length === 0) {
        // Orphaned - remove exercise and its media
        await appDb.cachedExercises.delete(exerciseId);
        await appDb.cachedMedia.where('exerciseId').equals(exerciseId).delete();
      } else {
        await appDb.cachedExercises.update(exerciseId, {
          routineIds: updatedRoutineIds,
        });
      }
    }
  },

  async pinRoutine(routineId: string, pinned: boolean): Promise<void> {
    const routine = await appDb.cachedRoutines.get(routineId);
    if (!routine) return;

    await appDb.cachedRoutines.update(routineId, {
      pinned,
      expiresAt: pinned ? null : Date.now() + FOURTEEN_DAYS_MS,
    });
  },

  async getCachedRoutine(routineId: string): Promise<CachedRoutine | null> {
    const routine = await appDb.cachedRoutines.get(routineId);
    return routine ?? null;
  },

  async getAllCachedRoutines(userId: string): Promise<CachedRoutine[]> {
    return appDb.cachedRoutines.where('userId').equals(userId).toArray();
  },

  async isRoutineCached(routineId: string): Promise<boolean> {
    const routine = await appDb.cachedRoutines.get(routineId);
    return !!routine;
  },

  // ── Exercise/Media ─────────────────────────────────────

  async getCachedExercise(exerciseId: string): Promise<CachedExercise | null> {
    const exercise = await appDb.cachedExercises.get(exerciseId);
    return exercise ?? null;
  },

  async getCachedMediaUrl(exerciseId: string): Promise<string | null> {
    const media = await appDb.cachedMedia
      .where('exerciseId')
      .equals(exerciseId)
      .first();

    if (!media) return null;
    return URL.createObjectURL(media.blob);
  },

  async getCachedMediaBlob(exerciseId: string): Promise<Blob | null> {
    const media = await appDb.cachedMedia
      .where('exerciseId')
      .equals(exerciseId)
      .first();

    return media?.blob ?? null;
  },

  // ── Storage ────────────────────────────────────────────

  async getTotalStorageUsed(): Promise<number> {
    const routines = await appDb.cachedRoutines.toArray();
    return routines.reduce((acc, r) => acc + r.sizeBytes, 0);
  },

  async getRoutineStorageUsed(routineId: string): Promise<number> {
    const routine = await appDb.cachedRoutines.get(routineId);
    return routine?.sizeBytes ?? 0;
  },

  async getStorageEstimate(): Promise<{ used: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage ?? 0,
        quota: estimate.quota ?? 0,
      };
    }
    return { used: 0, quota: 0 };
  },

  // ── Cleanup ────────────────────────────────────────────

  async cleanupExpired(): Promise<void> {
    const now = Date.now();
    const expiredRoutines = await appDb.cachedRoutines
      .filter((r) => !r.pinned && r.expiresAt !== null && r.expiresAt < now)
      .toArray();

    for (const routine of expiredRoutines) {
      await this.uncacheRoutine(routine.id);
    }

    await updateLastCleanup();
  },

  async clearAllOfflineData(): Promise<void> {
    await appDb.cachedRoutines.clear();
    await appDb.cachedExercises.clear();
    await appDb.cachedMedia.clear();
  },

  // ── Refresh Expiry ─────────────────────────────────────

  async refreshRoutineExpiry(routineId: string): Promise<void> {
    const routine = await appDb.cachedRoutines.get(routineId);
    if (!routine || routine.pinned) return;

    await appDb.cachedRoutines.update(routineId, {
      expiresAt: Date.now() + FOURTEEN_DAYS_MS,
    });
  },
};
