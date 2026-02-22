import Dexie, { type Table } from 'dexie';

export interface PendingArchive {
  id?: number;
  userId: string;
  data: Record<string, unknown>;
  createdAt: number;
}

export interface PendingMedia {
  id?: number;
  userId: string;
  archiveId: string;
  fileName: string;
  blob: Blob;
  type: 'photo' | 'video';
  createdAt: number;
}

export interface CachedMedia {
  id?: number;
  url: string;
  blob: Blob;
  cachedAt: number;
}

export interface WorkoutStateCache {
  id?: number;
  workoutId: string;
  userId: string;
  state: Record<string, unknown>;
  updatedAt: number;
}

class AppDatabase extends Dexie {
  pendingArchives!: Table<PendingArchive>;
  pendingMedia!: Table<PendingMedia>;
  cachedMedia!: Table<CachedMedia>;
  workoutState!: Table<WorkoutStateCache>;

  constructor() {
    super('IntuitiveMobility');
    this.version(1).stores({
      pendingArchives: '++id, userId, createdAt',
      pendingMedia: '++id, userId, archiveId, createdAt',
      cachedMedia: '++id, url, cachedAt',
      workoutState: '++id, workoutId, userId, updatedAt',
    });
  }
}

export const appDb = new AppDatabase();

// ── Queue Operations ──────────────────────────────────────

export async function queueArchive(userId: string, data: Record<string, unknown>) {
  await appDb.pendingArchives.add({
    userId,
    data,
    createdAt: Date.now(),
  });
}

export async function getPendingArchives(userId: string) {
  return appDb.pendingArchives.where('userId').equals(userId).toArray();
}

export async function removePendingArchive(id: number) {
  await appDb.pendingArchives.delete(id);
}

export async function queueMedia(
  userId: string,
  archiveId: string,
  fileName: string,
  blob: Blob,
  type: 'photo' | 'video'
) {
  await appDb.pendingMedia.add({
    userId,
    archiveId,
    fileName,
    blob,
    type,
    createdAt: Date.now(),
  });
}

export async function getPendingMedia(userId: string) {
  return appDb.pendingMedia.where('userId').equals(userId).toArray();
}

export async function removePendingMedia(id: number) {
  await appDb.pendingMedia.delete(id);
}

export async function cacheWorkoutState(
  workoutId: string,
  userId: string,
  state: Record<string, unknown>
) {
  const existing = await appDb.workoutState
    .where('workoutId')
    .equals(workoutId)
    .first();

  if (existing) {
    await appDb.workoutState.update(existing.id!, {
      state,
      updatedAt: Date.now(),
    });
  } else {
    await appDb.workoutState.add({
      workoutId,
      userId,
      state,
      updatedAt: Date.now(),
    });
  }
}

export async function getCachedWorkoutState(workoutId: string) {
  return appDb.workoutState.where('workoutId').equals(workoutId).first();
}

export async function removeCachedWorkoutState(workoutId: string) {
  await appDb.workoutState.where('workoutId').equals(workoutId).delete();
}
