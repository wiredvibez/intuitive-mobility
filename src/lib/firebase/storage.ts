import {
  ref,
  uploadBytes,
  getDownloadURL as fbGetDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './config';

export async function uploadExerciseMedia(
  userId: string,
  file: File | Blob,
  exerciseId: string
): Promise<{ url: string; path: string }> {
  const ext = file instanceof File ? file.name.split('.').pop() : 'mp4';
  const path = `exercises/${userId}/${exerciseId}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await fbGetDownloadURL(storageRef);
  return { url, path };
}

export async function uploadMemoryMedia(
  userId: string,
  archiveId: string,
  file: Blob,
  fileName: string
): Promise<{ url: string; path: string }> {
  const path = `users/${userId}/memories/${archiveId}/${fileName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await fbGetDownloadURL(storageRef);
  return { url, path };
}

export async function deleteMedia(path: string) {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('Failed to delete media:', path, err);
  }
}

export async function getDownloadURL(path: string): Promise<string> {
  const storageRef = ref(storage, path);
  return fbGetDownloadURL(storageRef);
}
