import {
  getPendingArchives,
  removePendingArchive,
  getPendingMedia,
  removePendingMedia,
} from './dexie';
import {
  createArchiveEntry,
  updateExerciseStatsForCompletedWorkout,
} from '../firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { uploadMemoryMedia } from '../firebase/storage';
import type { ArchiveEntry } from '../types';

function toTimestamp(val: unknown): Timestamp {
  if (val instanceof Timestamp) return val;
  if (
    val &&
    typeof val === 'object' &&
    'seconds' in val &&
    typeof (val as { seconds: unknown }).seconds === 'number'
  ) {
    const obj = val as { seconds: number; nanoseconds?: number };
    return new Timestamp(obj.seconds, obj.nanoseconds ?? 0);
  }
  // Fallback: log warning and use current time
  if (process.env.NODE_ENV !== 'production') {
    console.warn('toTimestamp: invalid input, falling back to now()', val);
  }
  return Timestamp.now();
}

const MAX_RETRIES = 3;
const BASE_DELAY = 2000;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await delay(BASE_DELAY * Math.pow(2, attempt));
    }
  }
  throw new Error('Max retries exceeded');
}

export async function processSyncQueue(userId: string) {
  if (!navigator.onLine) return;

  // Process pending archives
  const pendingArchives = await getPendingArchives(userId);
  for (const pending of pendingArchives) {
    try {
      const data = pending.data as unknown as Omit<ArchiveEntry, 'id'>;
      await withRetry(() => createArchiveEntry(userId, data));
      if (data.blocks_completed?.length) {
        await updateExerciseStatsForCompletedWorkout(
          userId,
          data.blocks_completed,
          toTimestamp(data.completed_at)
        );
      }
      await removePendingArchive(pending.id!);
    } catch (err) {
      console.error('Failed to sync archive:', err);
    }
  }

  // Process pending media
  const pendingMedia = await getPendingMedia(userId);
  for (const media of pendingMedia) {
    try {
      await withRetry(() =>
        uploadMemoryMedia(
          userId,
          media.archiveId,
          media.blob,
          media.fileName
        )
      );
      await removePendingMedia(media.id!);
    } catch (err) {
      console.error('Failed to sync media:', err);
    }
  }
}
