import Dexie, { type Table } from 'dexie';
import type { Routine, Exercise } from '../types';

// ── Existing Tables ──────────────────────────────────────

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

export interface WorkoutStateCache {
  id?: number;
  workoutId: string;
  userId: string;
  state: Record<string, unknown>;
  updatedAt: number;
}

// ── Offline Cache Tables ─────────────────────────────────

export interface CachedMedia {
  id?: number;
  url: string;
  exerciseId: string;
  blob: Blob;
  sizeBytes: number;
  cachedAt: number;
}

export interface CachedRoutine {
  id: string;
  userId: string;
  routine: Routine;
  exerciseIds: string[];
  cachedAt: number;
  expiresAt: number | null;
  pinned: boolean;
  sizeBytes: number;
}

export interface CachedExercise {
  id: string;
  exercise: Exercise;
  routineIds: string[];
  cachedAt: number;
}

export interface OfflineSettings {
  id: string;
  enabled: boolean;
  lastCleanupAt: number;
}

class AppDatabase extends Dexie {
  pendingArchives!: Table<PendingArchive>;
  pendingMedia!: Table<PendingMedia>;
  cachedMedia!: Table<CachedMedia>;
  workoutState!: Table<WorkoutStateCache>;
  cachedRoutines!: Table<CachedRoutine>;
  cachedExercises!: Table<CachedExercise>;
  offlineSettings!: Table<OfflineSettings>;

  constructor() {
    super('IntuitiveMobility');

    this.version(1).stores({
      pendingArchives: '++id, userId, createdAt',
      pendingMedia: '++id, userId, archiveId, createdAt',
      cachedMedia: '++id, url, cachedAt',
      workoutState: '++id, workoutId, userId, updatedAt',
    });

    this.version(2).stores({
      pendingArchives: '++id, userId, createdAt',
      pendingMedia: '++id, userId, archiveId, createdAt',
      cachedMedia: '++id, url, exerciseId, cachedAt',
      workoutState: '++id, workoutId, userId, updatedAt',
      cachedRoutines: 'id, userId, expiresAt, pinned',
      cachedExercises: 'id, *routineIds',
      offlineSettings: 'id',
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

// ── Offline Settings ─────────────────────────────────────

const SETTINGS_ID = 'settings';

export async function getOfflineSettings(): Promise<OfflineSettings> {
  const settings = await appDb.offlineSettings.get(SETTINGS_ID);
  return settings ?? { id: SETTINGS_ID, enabled: false, lastCleanupAt: 0 };
}

export async function setOfflineEnabled(enabled: boolean): Promise<void> {
  const existing = await appDb.offlineSettings.get(SETTINGS_ID);
  if (existing) {
    await appDb.offlineSettings.update(SETTINGS_ID, { enabled });
  } else {
    await appDb.offlineSettings.add({
      id: SETTINGS_ID,
      enabled,
      lastCleanupAt: Date.now(),
    });
  }
}

export async function updateLastCleanup(): Promise<void> {
  const existing = await appDb.offlineSettings.get(SETTINGS_ID);
  if (existing) {
    await appDb.offlineSettings.update(SETTINGS_ID, {
      lastCleanupAt: Date.now(),
    });
  }
}
