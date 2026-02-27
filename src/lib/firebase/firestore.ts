import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from './config';
import type {
  UserProfile,
  Exercise,
  Routine,
  Workout,
  ArchiveEntry,
  RoutineBlock,
  VideoImportJob,
  VideoImportJobStatus,
  ImportExerciseItem,
  UserExerciseStats,
  CompletedBlock,
} from '../types';

// ── User Operations ───────────────────────────────────────
export async function createUser(
  userId: string,
  data: Omit<UserProfile, 'id' | 'createdAt'>
) {
  await setDoc(doc(db, 'users', userId), {
    id: userId,
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function getUser(userId: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function updateUser(
  userId: string,
  data: Partial<UserProfile>
) {
  await updateDoc(doc(db, 'users', userId), data);
}

// ── Exercise Operations ───────────────────────────────────
export async function createExercise(
  data: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = doc(collection(db, 'exercises'));
  await setDoc(ref, {
    id: ref.id,
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const snap = await getDoc(doc(db, 'exercises', id));
  return snap.exists() ? (snap.data() as Exercise) : null;
}

export async function getUserExercises(userId: string): Promise<Exercise[]> {
  const q = query(
    collection(db, 'exercises'),
    where('author_id', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Exercise);
}

export async function getPublicExercises(): Promise<Exercise[]> {
  const q = query(
    collection(db, 'exercises'),
    where('is_public', '==', true),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Exercise);
}

export async function getAllAccessibleExercises(
  userId: string
): Promise<Exercise[]> {
  const [userExercises, publicExercises] = await Promise.all([
    getUserExercises(userId),
    getPublicExercises(),
  ]);
  // Merge and deduplicate
  const seen = new Set<string>();
  const all: Exercise[] = [];
  for (const ex of [...userExercises, ...publicExercises]) {
    if (!seen.has(ex.id)) {
      seen.add(ex.id);
      all.push(ex);
    }
  }
  return all;
}

export async function updateExercise(
  id: string,
  data: Partial<Exercise>
) {
  await updateDoc(doc(db, 'exercises', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteExercise(id: string) {
  await deleteDoc(doc(db, 'exercises', id));
}

// ── Routine Operations ────────────────────────────────────
export async function createRoutine(
  userId: string,
  data: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = doc(collection(db, 'users', userId, 'routines'));
  await setDoc(ref, {
    id: ref.id,
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getRoutine(
  userId: string,
  routineId: string
): Promise<Routine | null> {
  const snap = await getDoc(
    doc(db, 'users', userId, 'routines', routineId)
  );
  return snap.exists() ? (snap.data() as Routine) : null;
}

export async function getUserRoutines(userId: string): Promise<Routine[]> {
  const q = query(
    collection(db, 'users', userId, 'routines'),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Routine);
}

export async function updateRoutine(
  userId: string,
  routineId: string,
  data: Partial<Routine>
) {
  await updateDoc(doc(db, 'users', userId, 'routines', routineId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRoutine(userId: string, routineId: string) {
  await deleteDoc(doc(db, 'users', userId, 'routines', routineId));
}

// ── Workout Operations ────────────────────────────────────
export async function createWorkout(
  userId: string,
  data: Omit<Workout, 'id'>
): Promise<string> {
  const ref = doc(collection(db, 'users', userId, 'workouts'));
  await setDoc(ref, { id: ref.id, ...data });
  return ref.id;
}

export async function getActiveWorkout(
  userId: string
): Promise<Workout | null> {
  const q = query(
    collection(db, 'users', userId, 'workouts'),
    where('state', 'in', ['active', 'paused'])
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as Workout;
}

export async function updateWorkoutState(
  userId: string,
  workoutId: string,
  data: Partial<Workout>
) {
  await updateDoc(doc(db, 'users', userId, 'workouts', workoutId), {
    ...data,
    last_active_timestamp: serverTimestamp(),
  });
}

export async function deleteWorkout(userId: string, workoutId: string) {
  await deleteDoc(doc(db, 'users', userId, 'workouts', workoutId));
}

// ── Archive Operations ────────────────────────────────────
/** Remove undefined values (Firestore rejects them) */
function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) return obj;
  if (obj === null) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      item === undefined ? null : sanitizeForFirestore(item)
    ) as T;
  }
  if (typeof obj === 'object' && obj !== null) {
    const result = {} as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        result[k] = sanitizeForFirestore(v);
      }
    }
    return result as T;
  }
  return obj;
}

export async function createArchiveEntry(
  userId: string,
  data: Omit<ArchiveEntry, 'id'>
): Promise<string> {
  const ref = doc(collection(db, 'users', userId, 'archive'));
  const sanitized = sanitizeForFirestore({ id: ref.id, ...data });
  await setDoc(ref, sanitized);
  return ref.id;
}

export async function getArchiveEntries(
  userId: string
): Promise<ArchiveEntry[]> {
  const q = query(
    collection(db, 'users', userId, 'archive'),
    orderBy('completed_at', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as ArchiveEntry);
}

export async function getArchiveEntry(
  userId: string,
  archiveId: string
): Promise<ArchiveEntry | null> {
  const snap = await getDoc(
    doc(db, 'users', userId, 'archive', archiveId)
  );
  return snap.exists() ? (snap.data() as ArchiveEntry) : null;
}

// ── User Exercise Stats ───────────────────────────────────
/** Aggregate completed blocks by exercise for stats update */
function aggregateBlocksByExercise(
  blocks: CompletedBlock[]
): Map<
  string,
  {
    exercise_name: string;
    completions: number;
    skips: number;
    planned: number;
    actual: number;
    timeAdded: number;
  }
> {
  const map = new Map<
    string,
    {
      exercise_name: string;
      completions: number;
      skips: number;
      planned: number;
      actual: number;
      timeAdded: number;
    }
  >();
  for (const b of blocks) {
    if (b.type !== 'exercise' || !b.exercise_id) continue;
    const existing = map.get(b.exercise_id) ?? {
      exercise_name: b.exercise_name ?? '',
      completions: 0,
      skips: 0,
      planned: 0,
      actual: 0,
      timeAdded: 0,
    };
    if (b.skipped) {
      existing.skips += 1;
    } else {
      existing.completions += 1;
      existing.planned += b.planned_duration_secs;
      existing.actual += b.actual_duration_secs;
      existing.timeAdded += b.time_added_secs;
    }
    if (b.exercise_name) existing.exercise_name = b.exercise_name;
    map.set(b.exercise_id, existing);
  }
  return map;
}

export async function updateExerciseStatsForCompletedWorkout(
  userId: string,
  blocks: CompletedBlock[],
  completedAt: Timestamp
): Promise<void> {
  const byExercise = aggregateBlocksByExercise(blocks);
  if (byExercise.size === 0) return;

  await runTransaction(db, async (tx) => {
    const now = serverTimestamp();
    for (const [exerciseId, delta] of Array.from(byExercise.entries())) {
      const ref = doc(db, 'users', userId, 'exercise_stats', exerciseId);
      const snap = await tx.get(ref);
      const existing = snap.exists() ? (snap.data() as UserExerciseStats) : null;

      const completions = (existing?.completions ?? 0) + delta.completions;
      const totalActual = (existing?.total_actual_duration_secs ?? 0) + delta.actual;

      const updated: Omit<UserExerciseStats, 'updated_at'> & { updated_at: ReturnType<typeof serverTimestamp> } = {
        user_id: userId,
        exercise_id: exerciseId,
        exercise_name: delta.exercise_name || existing?.exercise_name || '',
        completions,
        skips: (existing?.skips ?? 0) + delta.skips,
        workouts_included: (existing?.workouts_included ?? 0) + 1,
        total_planned_duration_secs: (existing?.total_planned_duration_secs ?? 0) + delta.planned,
        total_actual_duration_secs: totalActual,
        total_time_added_secs: (existing?.total_time_added_secs ?? 0) + delta.timeAdded,
        avg_duration_secs: completions > 0 ? totalActual / completions : 0,
        first_completed_at: existing?.first_completed_at ?? completedAt,
        last_completed_at: completedAt,
        updated_at: now,
      };
      tx.set(ref, updated);
    }
  });
}

export async function getExerciseStats(
  userId: string,
  exerciseId: string
): Promise<UserExerciseStats | null> {
  const snap = await getDoc(
    doc(db, 'users', userId, 'exercise_stats', exerciseId)
  );
  return snap.exists() ? (snap.data() as UserExerciseStats) : null;
}

export async function getAllExerciseStats(
  userId: string
): Promise<UserExerciseStats[]> {
  const q = query(
    collection(db, 'users', userId, 'exercise_stats'),
    orderBy('last_completed_at', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserExerciseStats);
}

// ── Video Import Jobs ────────────────────────────────────
export async function createVideoImportJob(
  userId: string,
  instagramUrl: string
): Promise<string> {
  const ref = doc(collection(db, 'video_import_jobs'));
  const now = serverTimestamp();
  await setDoc(ref, {
    id: ref.id,
    user_id: userId,
    instagram_url: instagramUrl,
    status: 'created',
    created_at: now,
    updated_at: now,
    exercises: [],
  });
  return ref.id;
}

export async function getVideoImportJob(
  jobId: string
): Promise<VideoImportJob | null> {
  const snap = await getDoc(doc(db, 'video_import_jobs', jobId));
  return snap.exists() ? (snap.data() as VideoImportJob) : null;
}

export async function getUserVideoImportJobs(
  userId: string
): Promise<VideoImportJob[]> {
  const q = query(
    collection(db, 'video_import_jobs'),
    where('user_id', '==', userId),
    orderBy('created_at', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as VideoImportJob);
}

const TERMINAL_JOB_STATUSES: readonly VideoImportJobStatus[] = ['complete', 'error', 'rejected'];

export async function getPendingVideoImportJobs(
  userId: string
): Promise<VideoImportJob[]> {
  const q = query(
    collection(db, 'video_import_jobs'),
    where('user_id', '==', userId),
    orderBy('created_at', 'desc')
  );
  const snap = await getDocs(q);
  const jobs = snap.docs.map((d) => d.data() as VideoImportJob);
  return jobs.filter((j) => !TERMINAL_JOB_STATUSES.includes(j.status));
}

export async function updateVideoImportJob(
  jobId: string,
  data: Partial<VideoImportJob>
) {
  await updateDoc(doc(db, 'video_import_jobs', jobId), {
    ...data,
    updated_at: serverTimestamp(),
  });
}

export async function updateImportExerciseItem(
  jobId: string,
  exerciseIndex: number,
  updates: Partial<ImportExerciseItem>
) {
  const job = await getVideoImportJob(jobId);
  if (!job) throw new Error('Job not found');
  const exercises = [...job.exercises];
  const idx = exercises.findIndex((e) => e.index === exerciseIndex);
  if (idx === -1) throw new Error('Exercise not found');
  exercises[idx] = { ...exercises[idx], ...updates };
  await updateVideoImportJob(jobId, { exercises });
}

// ── Admin Settings ────────────────────────────────────────
export interface AppSettings {
  instagram_cookies_base64?: string;
  cookies_updated_at?: Timestamp;
  cookies_updated_by?: string;
}

export async function getAppSettings(): Promise<AppSettings | null> {
  const snap = await getDoc(doc(db, 'app_settings', 'instagram'));
  return snap.exists() ? (snap.data() as AppSettings) : null;
}

export async function saveInstagramCookies(
  cookiesBase64: string,
  userId: string
): Promise<void> {
  await setDoc(
    doc(db, 'app_settings', 'instagram'),
    {
      instagram_cookies_base64: cookiesBase64,
      cookies_updated_at: serverTimestamp(),
      cookies_updated_by: userId,
    },
    { merge: true }
  );
}

// ── Helpers ───────────────────────────────────────────────
export function applyRoutineModifications(
  blocks: RoutineBlock[],
  modifications: { blockId: string; newDuration?: number; remove?: boolean }[]
): RoutineBlock[] {
  const modMap = new Map(modifications.map((m) => [m.blockId, m]));
  return blocks
    .filter((b) => {
      const mod = modMap.get(b.id);
      return !mod?.remove;
    })
    .map((b) => {
      const mod = modMap.get(b.id);
      if (mod?.newDuration && b.type === 'exercise') {
        return { ...b, duration_secs: mod.newDuration };
      }
      return b;
    });
}
