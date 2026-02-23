import {
  getPendingArchives,
  removePendingArchive,
  getPendingMedia,
  removePendingMedia,
} from './dexie';
import { createArchiveEntry } from '../firebase/firestore';
import { uploadMemoryMedia } from '../firebase/storage';
import type { ArchiveEntry } from '../types';

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
      await withRetry(() =>
        createArchiveEntry(userId, pending.data as unknown as Omit<ArchiveEntry, 'id'>)
      );
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
