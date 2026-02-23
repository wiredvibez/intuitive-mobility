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
} from 'firebase/firestore';
import { db } from './config';
import type {
  UserProfile,
  Exercise,
  Routine,
  Workout,
  ArchiveEntry,
  RoutineBlock,
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
export async function createArchiveEntry(
  userId: string,
  data: Omit<ArchiveEntry, 'id'>
): Promise<string> {
  const ref = doc(collection(db, 'users', userId, 'archive'));
  await setDoc(ref, { id: ref.id, ...data });
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
